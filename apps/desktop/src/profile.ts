// Export/import of .forja profiles — the headline feature. A profile is just a
// list of program ids plus light metadata. Uses Tauri dialog+fs when available,
// browser download / file-input otherwise. Recent profiles live in localStorage.

import type { ForjaProfile } from "@forja/catalog";
import { isTauri } from "./tauri";

const RECENTS_KEY = "forja.recents";

export function buildProfile(name: string, programIds: string[]): ForjaProfile {
  return {
    version: 1,
    name,
    exportedAt: new Date().toISOString(),
    programIds,
  };
}

/** Save a profile to a .forja file. Returns true if the user completed the save. */
export async function exportProfile(profile: ForjaProfile): Promise<boolean> {
  const json = JSON.stringify(profile, null, 2);
  const fileName = `${sanitize(profile.name)}.forja`;

  let saved = false;
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: "Perfil Forja", extensions: ["forja"] }],
    });
    if (path) {
      await writeTextFile(path, json);
      saved = true;
    }
  } else {
    download(fileName, json);
    saved = true;
  }

  if (saved) rememberRecent(profile);
  return saved;
}

/** Open a .forja file and return its parsed profile, or null if cancelled. */
export async function importProfile(): Promise<ForjaProfile | null> {
  let text: string | null = null;
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await open({
      multiple: false,
      filters: [{ name: "Perfil Forja", extensions: ["forja"] }],
    });
    if (typeof path === "string") text = await readTextFile(path);
  } else {
    text = await pickFile();
  }
  if (!text) return null;

  const profile = parseProfile(text);
  rememberRecent(profile);
  return profile;
}

export function parseProfile(text: string): ForjaProfile {
  const data = JSON.parse(text);
  if (!Array.isArray(data.programIds)) {
    throw new Error("Arquivo .forja inválido: sem lista de programas.");
  }
  return {
    version: 1,
    name: typeof data.name === "string" ? data.name : "perfil",
    exportedAt:
      typeof data.exportedAt === "string"
        ? data.exportedAt
        : new Date().toISOString(),
    programIds: data.programIds.filter((x: unknown) => typeof x === "string"),
  };
}

// --- recents (localStorage) ---
export function getRecents(): ForjaProfile[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function rememberRecent(profile: ForjaProfile) {
  const recents = getRecents().filter((p) => p.name !== profile.name);
  recents.unshift(profile);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(recents.slice(0, 6)));
}

// --- helpers ---
const sanitize = (s: string) =>
  s.trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "meu-setup";

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function pickFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".forja,application/json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };
    input.click();
  });
}
