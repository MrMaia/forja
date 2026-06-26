// Bridge to the Rust backend. When running outside Tauri (plain `pnpm dev` in a
// browser) it falls back to importing the seed JSON and simulating installs, so
// the whole UI is demoable without the Rust toolchain.

import type { Program, Preset, InstallProgress } from "@forja/catalog";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface InstallItem {
  id: string;
  winget: string | null;
  fallbackUrl: string | null;
  action?: "install" | "upgrade";
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
      if (!item.winget) {
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
