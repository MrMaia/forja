import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { Program, InstallProgress } from "@forja/catalog";
import { ForjaProvider, useForja } from "./store";

let progressCb: ((p: InstallProgress) => void) | undefined;

vi.mock("./tauri", () => ({
  APP_VERSION: "0.1.6",
  getCatalog: vi.fn(async (): Promise<Program[]> => [programA, programB]),
  getPresets: vi.fn(async () => []),
  checkInstalled: vi.fn(async () => []),
  checkPathTools: vi.fn(async () => []),
  addToUserPath: vi.fn(async () => {}),
  installPrograms: vi.fn(async () => {}),
  onInstallProgress: vi.fn(async (cb: (p: InstallProgress) => void) => {
    progressCb = cb;
    return () => {
      progressCb = undefined;
    };
  }),
  checkForjaUpdate: vi.fn(async () => ({
    current: "0.1.6",
    latest: null,
    hasUpdate: false,
    url: "",
    installUrl: null,
    sha256: null,
  })),
  installUpdate: vi.fn(async () => {}),
  openExternal: vi.fn(async () => {}),
  isAdmin: vi.fn(async () => false),
  relaunchAsAdmin: vi.fn(async () => {}),
}));

const programA: Program = {
  id: "prog-a",
  name: "Program A",
  category: "Desenvolvimento",
  description: "",
  icon: { label: "A", bg: "#000", fg: "#fff" },
  iconUrl: null,
  winget: "Vendor.ProgramA",
  fallbackUrl: null,
  postInstall: [],
};

const programB: Program = {
  id: "prog-b",
  name: "Program B",
  category: "Desenvolvimento",
  description: "",
  icon: { label: "B", bg: "#000", fg: "#fff" },
  iconUrl: null,
  winget: "Vendor.ProgramB",
  fallbackUrl: null,
  postInstall: [],
};

async function setup() {
  const { result } = renderHook(() => useForja(), { wrapper: ForjaProvider });
  await waitFor(() => expect(result.current.loading).toBe(false));
  await waitFor(() => expect(progressCb).toBeDefined());
  return result;
}

beforeEach(() => {
  progressCb = undefined;
});

describe("install queue", () => {
  it("queues every selected program as 'queued' and marks installing", async () => {
    const result = await setup();

    act(() => result.current.startInstall([programA, programB]));

    expect(result.current.installing).toBe(true);
    expect(result.current.installQueue.map((p) => p.id)).toEqual(["prog-a", "prog-b"]);
    expect(result.current.installRows["prog-a"]?.status).toBe("queued");
    expect(result.current.installRows["prog-b"]?.status).toBe("queued");
  });

  it("applies progress events to the matching row independently", async () => {
    const result = await setup();
    act(() => result.current.startInstall([programA, programB]));

    // both run concurrently — B can finish before A even starts downloading
    act(() => {
      progressCb?.({ id: "prog-b", status: "installing", line: "Instalando…" });
      progressCb?.({ id: "prog-a", status: "downloading", percent: 42 });
    });

    expect(result.current.installRows["prog-a"]).toMatchObject({ status: "downloading", percent: 42 });
    expect(result.current.installRows["prog-b"]).toMatchObject({ status: "installing", line: "Instalando…" });
  });

  it("stops 'installing' once every queued item reaches a terminal state", async () => {
    const result = await setup();
    act(() => result.current.startInstall([programA, programB]));

    act(() => {
      progressCb?.({ id: "prog-a", status: "done" });
    });
    expect(result.current.installing).toBe(true); // prog-b still pending

    act(() => {
      progressCb?.({ id: "prog-b", status: "error", line: "falhou" });
    });
    await waitFor(() => expect(result.current.installing).toBe(false));
  });

  it("clearCompleted drops terminal items but keeps active ones", async () => {
    const result = await setup();
    act(() => result.current.startInstall([programA, programB]));

    act(() => {
      progressCb?.({ id: "prog-a", status: "done" });
      progressCb?.({ id: "prog-b", status: "downloading", percent: 10 });
    });

    act(() => result.current.clearCompleted());

    expect(result.current.installQueue.map((p) => p.id)).toEqual(["prog-b"]);
    expect(result.current.installRows["prog-a"]).toBeUndefined();
    expect(result.current.installRows["prog-b"]?.status).toBe("downloading");
  });
});
