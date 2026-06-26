// Manifest schema — the single source of truth shared by the Rust backend
// (serde structs in src-tauri/src/catalog.rs) and the React frontend.
// Keep these types in sync with the Rust structs.

export type Category =
  | "Essenciais"
  | "Navegadores"
  | "Comunicação"
  | "Mídia"
  | "Produtividade"
  | "Desenvolvimento"
  | "Games"
  | "Drivers";

// 2-letter monogram tile, matching the prototype (no real logo assets).
export interface ProgramIcon {
  label: string; // e.g. "VS", ">_"
  bg: string; // tile background, e.g. "#2d4257"
  fg: string; // monogram color, e.g. "#dfe7ef"
}

export interface Program {
  id: string; // kebab-case, stable — this is what profiles store
  name: string;
  category: Category;
  description: string;
  icon: ProgramIcon; // monogram fallback (offline / broken iconUrl)
  iconUrl: string | null; // real logo (remote); falls back to icon
  winget: string | null; // winget package id, or null to use the fallback
  // extra winget-id prefixes that also count as "this is installed" — for
  // packages whose id is version-pinned (e.g. Python.Python.3.13 but any
  // Python.Python.* should count). Optional; defaults to none.
  detect?: string[];
  fallbackUrl: string | null; // official installer / deep-link when winget is null
  postInstall: string[]; // commands to run after install (reserved; not run in v1)
}

export interface Preset {
  id: string; // "dev", "gamer", ...
  name: string; // "Setup Dev"
  description: string;
  programIds: string[];
}

// Exported/imported .forja file — just a list of ids plus light metadata.
export interface ForjaProfile {
  version: 1;
  name: string;
  exportedAt: string; // ISO date
  programIds: string[];
}

// Per-item install lifecycle, emitted by the backend over the "install:progress" event.
export type InstallStatus =
  | "queued"
  | "downloading"
  | "installing"
  | "done"
  | "error"
  | "skipped";

export interface InstallProgress {
  id: string;
  status: InstallStatus;
  percent?: number; // download progress 0–100, when known
  line?: string; // latest stdout/stderr line, when present
}
