import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { InstallStatus, Program, Preset } from "@forja/catalog";
import { detectLang, translate, type Lang } from "./i18n";
import {
  getCatalog,
  getPresets,
  checkInstalled,
  checkPathTools,
  addToUserPath,
  installPrograms,
  onInstallProgress,
  type InstalledInfo,
  type PathToolInfo,
} from "./tauri";

export interface InstallRow {
  status: InstallStatus;
  line?: string;
  percent?: number;
  startedAt?: number; // ms epoch when the item first went active (for the timer)
}

const TERMINAL: InstallStatus[] = ["done", "error", "skipped"];

export type Screen =
  | "onboarding"
  | "catalog"
  | "presets"
  | "install"
  | "profiles"
  | "settings"
  | "drivers"
  | "tweaks";

export interface Settings {
  autoUpdateCheck: boolean; // check for app updates when Forja opens
  hideInstalled: boolean; // hide already-installed programs in the catalog
  lang: Lang; // UI language
}

const SETTINGS_KEY = "forja.settings";
const DEFAULT_SETTINGS: Settings = {
  autoUpdateCheck: true,
  hideInstalled: false,
  lang: detectLang(), // start in the OS/browser language
};

function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

interface ForjaContextValue {
  screen: Screen;
  go: (s: Screen) => void;
  catalog: Program[];
  presets: Preset[];
  loading: boolean;
  selected: Set<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  setSelection: (ids: string[]) => void;
  clear: () => void;
  byId: (id: string) => Program | undefined;
  selectedPrograms: () => Program[];
  installedOf: (id: string) => InstalledInfo | undefined;
  pathOf: (id: string) => PathToolInfo | undefined;
  isErrorDismissed: (id: string) => boolean;
  addToPath: (programId: string, dir: string) => Promise<void>;
  refreshInstalled: () => void;
  checking: boolean; // a manual "check for updates" is running
  updatesCount: number; // installed programs with a pending upgrade
  programsWithUpdates: () => Program[];
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  // install progress (global, so the "Instalações" tab can show it any time)
  installQueue: Program[];
  installRows: Record<string, InstallRow>;
  installing: boolean;
  startInstall: (programs: Program[]) => void;
  startUpgrade: (program: Program, wingetId: string) => void;
  startUninstall: (program: Program, wingetId: string) => void;
  upgradeAll: () => void; // upgrade every installed program with a pending update
  versionChoice: Record<string, string>; // programId -> chosen winget id
  setVersion: (programId: string, winget: string) => void;
}

const ForjaContext = createContext<ForjaContextValue | null>(null);

export function ForjaProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [catalog, setCatalog] = useState<Program[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [installed, setInstalled] = useState<Map<string, InstalledInfo>>(new Map());
  const [pathInfo, setPathInfo] = useState<Map<string, PathToolInfo>>(new Map());
  const [installQueue, setInstallQueue] = useState<Program[]>([]);
  const [installRows, setInstallRows] = useState<Record<string, InstallRow>>({});
  const [installing, setInstalling] = useState(false);
  // ids whose error has been auto-dismissed on the catalog card (kept globally so
  // it survives navigating away and back; the Instalações tab still shows the log)
  const [dismissedErrors, setDismissedErrors] = useState<Set<string>>(new Set());
  const errTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [checking, setChecking] = useState(false);
  const [versionChoice, setVersionChoice] = useState<Record<string, string>>({});
  const setVersion = useCallback(
    (programId: string, winget: string) =>
      setVersionChoice((prev) => ({ ...prev, [programId]: winget })),
    []
  );

  const updateSetting = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        try {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        } catch {
          /* ignore quota/private-mode errors */
        }
        return next;
      });
    },
    []
  );

  useEffect(() => {
    Promise.all([getCatalog(), getPresets()])
      .then(([c, p]) => {
        setCatalog(c);
        setPresets(p);
        void loadInstalled(c);
      })
      .catch((e) => console.error("Falha ao carregar catálogo:", e))
      .finally(() => setLoading(false));
  }, []);

  // Single global listener for install progress (survives screen changes).
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onInstallProgress((p) => {
      setInstallRows((prev) => {
        const old = prev[p.id];
        const active = p.status === "downloading" || p.status === "installing";
        // stamp the start the first time it goes active; keep it afterwards so the
        // finished row can show how long it took.
        const startedAt = old?.startedAt ?? (active ? Date.now() : undefined);
        return {
          ...prev,
          [p.id]: { status: p.status, line: p.line, percent: p.percent, startedAt },
        };
      });

      // any new status resets the card's error dismissal; an error (re)starts the
      // 8s timer that hides it on the card. Timer is global, so it doesn't reset
      // when the user switches tabs.
      const timers = errTimers.current;
      if (timers[p.id]) {
        clearTimeout(timers[p.id]);
        delete timers[p.id];
      }
      setDismissedErrors((prev) => {
        if (!prev.has(p.id)) return prev;
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
      if (p.status === "error") {
        timers[p.id] = setTimeout(() => {
          setDismissedErrors((prev) => new Set(prev).add(p.id));
        }, 8000);
      }
    }).then((u) => (unlisten = u));
    return () => {
      unlisten?.();
      Object.values(errTimers.current).forEach(clearTimeout);
    };
  }, []);

  // Query winget for install state of every program that has a winget id, and
  // probe dev tools by executable (PATH state) in parallel.
  async function loadInstalled(programs: Program[]) {
    const specs = programs
      .filter((p) => p.winget)
      .map((p) => ({
        id: p.id,
        exact: p.winget,
        prefixes: p.detect ?? [],
        names: [p.name],
      }));
    const pathSpecs = programs
      .filter((p) => p.exe && p.exe.length > 0)
      .map((p) => ({ id: p.id, exe: p.exe!, installDirs: p.installDirs ?? [] }));

    if (specs.length > 0) {
      try {
        const infos = await checkInstalled(specs);
        setInstalled(new Map(infos.map((info) => [info.id, info] as const)));
      } catch (e) {
        console.error("Falha ao detectar instalados:", e);
      }
    }
    if (pathSpecs.length > 0) {
      try {
        const infos = await checkPathTools(pathSpecs);
        setPathInfo(new Map(infos.map((info) => [info.id, info] as const)));
      } catch (e) {
        console.error("Falha ao detectar ferramentas no PATH:", e);
      }
    }
  }

  // manual "check for updates": re-run detection with a visible spinner
  async function checkForUpdates() {
    setChecking(true);
    try {
      await loadInstalled(catalog);
    } finally {
      setChecking(false);
    }
  }

  const startInstall = useCallback((programs: Program[]) => {
    if (programs.length === 0) return;
    setInstallQueue(programs);
    setInstallRows(
      Object.fromEntries(programs.map((p) => [p.id, { status: "queued" as InstallStatus }]))
    );
    setInstalling(true);
    installPrograms(
      programs.map((p) => ({
        id: p.id,
        winget: versionChoice[p.id] ?? p.winget, // honor the chosen version
        npm: p.npm,
        fallbackUrl: p.fallbackUrl,
      }))
    ).catch((e) => console.error("Falha na instalação:", e));
  }, [versionChoice]);

  // Upgrade routes through the same global queue/events as install, so it shows
  // in the "Instalações" tab and survives navigating away. Appends to the queue.
  const startUpgrade = useCallback((program: Program, wingetId: string) => {
    setInstallQueue((prev) =>
      prev.some((p) => p.id === program.id) ? prev : [...prev, program]
    );
    setInstallRows((prev) => ({ ...prev, [program.id]: { status: "queued" } }));
    setInstalling(true);
    installPrograms([
      { id: program.id, winget: wingetId, fallbackUrl: program.fallbackUrl, action: "upgrade" },
    ]).catch((e) => console.error("Falha ao atualizar:", e));
  }, []);

  // uninstall via the same global queue/events as install/upgrade
  const startUninstall = useCallback((program: Program, wingetId: string) => {
    setInstallQueue((prev) =>
      prev.some((p) => p.id === program.id) ? prev : [...prev, program]
    );
    setInstallRows((prev) => ({ ...prev, [program.id]: { status: "queued" } }));
    setInstalling(true);
    installPrograms([
      { id: program.id, winget: wingetId, fallbackUrl: program.fallbackUrl, action: "uninstall" },
    ]).catch((e) => console.error("Falha ao desinstalar:", e));
  }, []);

  // upgrade every installed program that has a pending update, in one go
  const upgradeAll = useCallback(() => {
    catalog
      .filter((p) => installed.get(p.id)?.available)
      .forEach((p) => {
        const target = installed.get(p.id)?.wingetId ?? p.winget;
        if (target) startUpgrade(p, target);
      });
  }, [catalog, installed, startUpgrade]);

  // When the whole queue reaches a terminal state, stop and re-detect versions.
  const refreshedRef = useRef(false);
  useEffect(() => {
    if (installQueue.length === 0) return;
    const allDone = installQueue.every((p) =>
      TERMINAL.includes(installRows[p.id]?.status)
    );
    if (allDone && !refreshedRef.current) {
      refreshedRef.current = true;
      setInstalling(false);
      void loadInstalled(catalog);
    } else if (!allDone) {
      refreshedRef.current = false;
    }
    // loadInstalled reads `catalog` from closure; safe — catalog is stable post-load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installRows, installQueue]);

  const index = useMemo(() => {
    const m = new Map<string, Program>();
    for (const p of catalog) m.set(p.id, p);
    return m;
  }, [catalog]);

  // Add a tool's dir to the user PATH, then mark it on-path locally so the
  // button disappears without a full re-detect. Throws on failure (UI shows it).
  const addToPath = useCallback(async (programId: string, dir: string) => {
    await addToUserPath(dir);
    setPathInfo((prev) => {
      const next = new Map(prev);
      const cur = next.get(programId);
      if (cur) next.set(programId, { ...cur, onPath: true, pathDir: null });
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const setSelection = useCallback(
    (ids: string[]) => setSelected(new Set(ids)),
    []
  );
  const clear = useCallback(() => setSelected(new Set()), []);

  const value: ForjaContextValue = {
    screen,
    go: setScreen,
    catalog,
    presets,
    loading,
    selected,
    isSelected: (id) => selected.has(id),
    toggle,
    setSelection,
    clear,
    byId: (id) => index.get(id),
    selectedPrograms: () =>
      [...selected].map((id) => index.get(id)).filter(Boolean) as Program[],
    installedOf: (id) => installed.get(id),
    pathOf: (id) => pathInfo.get(id),
    isErrorDismissed: (id) => dismissedErrors.has(id),
    addToPath,
    refreshInstalled: () => void checkForUpdates(),
    checking,
    updatesCount: [...installed.values()].filter((i) => i.available).length,
    programsWithUpdates: () =>
      catalog.filter((p) => installed.get(p.id)?.available),
    settings,
    updateSetting,
    installQueue,
    installRows,
    installing,
    startInstall,
    startUpgrade,
    startUninstall,
    upgradeAll,
    versionChoice,
    setVersion,
    t: (key, vars) => translate(settings.lang, key, vars),
  };

  return <ForjaContext.Provider value={value}>{children}</ForjaContext.Provider>;
}

export function useForja() {
  const ctx = useContext(ForjaContext);
  if (!ctx) throw new Error("useForja deve ser usado dentro de <ForjaProvider>");
  return ctx;
}
