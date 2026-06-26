// Bridge to the Rust backend. When running outside Tauri (plain `pnpm dev` in a
// browser) it falls back to importing the seed JSON and simulating installs, so
// the whole UI is demoable without the Rust toolchain.

import type { Program, Preset, InstallProgress } from "@forja/catalog";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface InstallItem {
  id: string;
  winget: string | null;
  npm?: string | null; // global npm package for CLIs not in winget
  fallbackUrl: string | null;
  action?: "install" | "upgrade" | "uninstall";
}

export interface InstalledInfo {
  id: string;
  wingetId: string | null; // actual id winget lists — use to upgrade
  installed: string | null;
  available: string | null;
}

export interface DetectSpec {
  id: string; // program id (key echoed back)
  exact: string | null; // winget id
  prefixes: string[]; // extra id prefixes that count as installed
  names: string[]; // display names that count as installed (non-winget installs)
}

export interface PathSpec {
  id: string;
  exe: string[];
  installDirs: string[];
}

export interface PathToolInfo {
  id: string;
  installed: boolean;
  onPath: boolean;
  pathDir: string | null; // dir to add to PATH when onPath is false
}

/** Detect dev tools by executable presence and whether they're on PATH. */
export async function checkPathTools(specs: PathSpec[]): Promise<PathToolInfo[]> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<PathToolInfo[]>("check_path_tools", { specs });
  }
  // Browser demo: pretend Python is installed but off PATH (to show the button),
  // and Git installed and on PATH.
  return specs.map(({ id }) => {
    if (id === "python")
      return { id, installed: true, onPath: false, pathDir: "C:\\Users\\demo\\Python313" };
    if (id === "git") return { id, installed: true, onPath: true, pathDir: null };
    return { id, installed: false, onPath: false, pathDir: null };
  });
}

/** Append a directory to the current user's PATH (idempotent). */
export async function addToUserPath(dir: string): Promise<void> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("add_to_user_path", { dir });
    return;
  }
  await delay(400); // browser mock: no-op
}

/** Detect installed version / pending upgrade for a set of programs. */
export async function checkInstalled(specs: DetectSpec[]): Promise<InstalledInfo[]> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<InstalledInfo[]>("check_installed", { specs });
  }
  // Browser demo: current, outdated, prefix-detected, and missing.
  return specs.map(({ id, exact }) => {
    const base = { id, wingetId: exact };
    if (id === "git") return { ...base, installed: "2.44.0", available: null };
    if (id === "nodejs")
      return { ...base, wingetId: "OpenJS.NodeJS.22", installed: "20.10.0", available: "20.12.2" };
    if (id === "chrome")
      return { ...base, wingetId: "Google.Chrome.EXE", installed: "124.0.6367.92", available: null };
    if (id === "python") return { ...base, installed: "3.14.0", available: null };
    return { ...base, installed: null, available: null };
  });
}


export async function getCatalog(): Promise<Program[]> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<Program[]>("get_catalog");
  }
  return (await import("@forja/catalog/catalog.json")).default as Program[];
}

export async function getPresets(): Promise<Preset[]> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<Preset[]>("get_presets");
  }
  return (await import("@forja/catalog/presets.json")).default as Preset[];
}

export async function installPrograms(items: InstallItem[]): Promise<void> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("install_programs", { items });
    return;
  }
  // Browser mock: queued -> downloading (with % bar) -> installing -> done.
  for (const item of items) emitMock({ id: item.id, status: "queued" });
  void (async () => {
    for (const item of items) {
      if (!item.winget && !item.npm) {
        emitMock({ id: item.id, status: "skipped", line: item.fallbackUrl ?? undefined });
        continue;
      }
      for (let p = 0; p <= 100; p += 20) {
        emitMock({ id: item.id, status: "downloading", percent: p });
        await delay(180);
      }
      emitMock({ id: item.id, status: "installing", line: "Instalando pacote…" });
      await delay(700 + Math.random() * 700);
      emitMock({ id: item.id, status: "done" });
    }
  })();
}

export async function onInstallProgress(
  cb: (p: InstallProgress) => void
): Promise<() => void> {
  if (isTauri) {
    const { listen } = await import("@tauri-apps/api/event");
    return listen<InstallProgress>("install:progress", (e) => cb(e.payload));
  }
  mockListeners.add(cb);
  return () => mockListeners.delete(cb);
}

export type TweakState = Record<string, boolean>;

/** Read current on/off state of all Windows tweaks. */
export async function readTweaks(): Promise<TweakState> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      return JSON.parse(await invoke<string>("read_tweaks")) as TweakState;
    } catch {
      return {};
    }
  }
  return {}; // browser demo: all off
}

/** Apply a single HKCU tweak (no admin). */
export async function applyUserTweak(key: string, on: boolean): Promise<void> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("apply_user_tweak", { key, on });
    return;
  }
  await delay(150);
}

/** Apply admin tweaks in one elevated batch (one UAC prompt). */
export async function applyAdminTweaks(items: { key: string; on: boolean }[]): Promise<void> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("apply_admin_tweaks", { items });
    return;
  }
  await delay(400);
}

/** Restart Explorer so taskbar/explorer tweaks take effect. */
export async function restartExplorer(): Promise<void> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("restart_explorer");
    return;
  }
  await delay(150);
}

export interface NetAdapter {
  Name: string;
  NetConnectionStatus: number | null; // 2 = connected
}
export interface NetworkInfo {
  manufacturer: string;
  model: string;
  adapters: NetAdapter[];
  missing: { Name: string }[]; // net devices without a working driver
}

/** Free disk space on the system drive, in bytes (0 if unknown). */
export async function diskFree(): Promise<number> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      return await invoke<number>("disk_free");
    } catch {
      return 0;
    }
  }
  return 412 * 1024 * 1024 * 1024; // browser demo: ~412 GB
}

/** Detect network hardware (make/model + adapters) — works offline. */
export async function detectNetwork(): Promise<NetworkInfo | null> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      const raw = await invoke<string>("detect_network");
      const o = JSON.parse(raw);
      const arr = <T,>(v: T | T[] | undefined): T[] =>
        Array.isArray(v) ? v : v ? [v] : [];
      return {
        manufacturer: String(o.manufacturer ?? "").trim(),
        model: String(o.model ?? "").trim(),
        adapters: arr<NetAdapter>(o.adapters),
        missing: arr<{ Name: string }>(o.missing),
      };
    } catch {
      return null;
    }
  }
  // browser demo
  return {
    manufacturer: "Lenovo",
    model: "ThinkPad X1 Carbon",
    adapters: [
      { Name: "Intel(R) Wi-Fi 6 AX201 160MHz", NetConnectionStatus: 2 },
      { Name: "Realtek PCIe GbE Family Controller", NetConnectionStatus: null },
    ],
    missing: [],
  };
}

export interface ForjaUpdate {
  current: string;
  latest: string | null; // null = couldn't determine / no releases yet
  hasUpdate: boolean;
  url: string; // releases page
  installUrl: string | null; // direct .exe asset, for one-click update
}

// naive semver compare: returns >0 if a is newer than b
function cmpVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

/** Check GitHub Releases for a newer Forja version. */
export async function checkForjaUpdate(current: string): Promise<ForjaUpdate> {
  const releasesUrl = "https://github.com/MrMaia/forja/releases";
  try {
    const res = await fetch(
      "https://api.github.com/repos/MrMaia/forja/releases/latest",
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok)
      return { current, latest: null, hasUpdate: false, url: releasesUrl, installUrl: null };
    const data = await res.json();
    const latest = String(data.tag_name ?? "").replace(/^v/, "");
    const exe = (data.assets ?? []).find((a: { name?: string }) =>
      String(a.name ?? "").toLowerCase().endsWith(".exe")
    );
    return {
      current,
      latest: latest || null,
      hasUpdate: !!latest && cmpVersions(latest, current) > 0,
      url: data.html_url ?? releasesUrl,
      installUrl: exe?.browser_download_url ?? null,
    };
  } catch {
    return { current, latest: null, hasUpdate: false, url: releasesUrl, installUrl: null };
  }
}

/** Download the release installer and launch it (one-click update). */
export async function installUpdate(url: string): Promise<void> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("install_update", { url });
    return;
  }
  window.open(url, "_blank", "noopener");
}

/** Open an external URL in the OS browser (used for fallback / driver deep-links). */
export async function openExternal(url: string): Promise<void> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}

// --- browser mock plumbing ---
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mockListeners = new Set<(p: InstallProgress) => void>();
function emitMock(p: InstallProgress) {
  for (const cb of mockListeners) cb(p);
}
