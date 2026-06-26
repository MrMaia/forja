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
import {
  getCatalog,
  getPresets,
  checkInstalled,
  installPrograms,
  onInstallProgress,
  type InstalledInfo,
} from "./tauri";

export interface InstallRow {
  status: InstallStatus;
  line?: string;
  percent?: number;
}

const TERMINAL: InstallStatus[] = ["done", "error", "skipped"];

export type Screen =
  | "onboarding"
  | "catalog"
  | "presets"
  | "install"
  | "profiles";

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
  refreshInstalled: () => void;
  // install progress (global, so the "Instalações" tab can show it any time)
  installQueue: Program[];
  installRows: Record<string, InstallRow>;
  installing: boolean;
  startInstall: (programs: Program[]) => void;
  startUpgrade: (program: Program, wingetId: string) => void;
}

const ForjaContext = createContext<ForjaContextValue | null>(null);

export function ForjaProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>("onboarding");
  const [catalog, setCatalog] = useState<Program[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [installed, setInstalled] = useState<Map<string, InstalledInfo>>(new Map());
  const [installQueue, setInstallQueue] = useState<Program[]>([]);
  const [installRows, setInstallRows] = useState<Record<string, InstallRow>>({});
  const [installing, setInstalling] = useState(false);

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
      setInstallRows((prev) => ({
        ...prev,
        [p.id]: { status: p.status, line: p.line, percent: p.percent },
      }));
    }).then((u) => (unlisten = u));
    return () => unlisten?.();
  }, []);

  // Query winget for install state of every program that has a winget id.
  async function loadInstalled(programs: Program[]) {
    const specs = programs
      .filter((p) => p.winget)
      .map((p) => ({ id: p.id, exact: p.winget, prefixes: p.detect ?? [] }));
    if (specs.length === 0) return;
    try {
      const infos = await checkInstalled(specs);
      setInstalled(new Map(infos.map((info) => [info.id, info] as const)));
    } catch (e) {
      console.error("Falha ao detectar instalados:", e);
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
      programs.map((p) => ({ id: p.id, winget: p.winget, fallbackUrl: p.fallbackUrl }))
    ).catch((e) => console.error("Falha na instalação:", e));
  }, []);

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
    refreshInstalled: () => void loadInstalled(catalog),
    installQueue,
    installRows,
    installing,
    startInstall,
    startUpgrade,
  };

  return <ForjaContext.Provider value={value}>{children}</ForjaContext.Provider>;
}

export function useForja() {
  const ctx = useContext(ForjaContext);
  if (!ctx) throw new Error("useForja deve ser usado dentro de <ForjaProvider>");
  return ctx;
}
