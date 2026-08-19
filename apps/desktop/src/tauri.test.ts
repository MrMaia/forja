import { afterEach, describe, expect, it, vi } from "vitest";
import { checkForjaUpdate } from "./tauri";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function textResponse(body: string): Response {
  return new Response(body, { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkForjaUpdate", () => {
  const exeUrl = "https://github.com/MrMaia/forja/releases/download/v0.2.0/Forja_0.2.0_x64-setup.exe";
  const sidecarUrl = `${exeUrl}.sha256`;
  const hash = "a".repeat(64);

  it("offers the one-click install when a matching .sha256 sidecar exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          tag_name: "v0.2.0",
          html_url: "https://github.com/MrMaia/forja/releases/tag/v0.2.0",
          assets: [
            { name: "Forja_0.2.0_x64-setup.exe", browser_download_url: exeUrl },
            { name: "Forja_0.2.0_x64-setup.exe.sha256", browser_download_url: sidecarUrl },
          ],
        })
      )
      .mockResolvedValueOnce(textResponse(`${hash}  Forja_0.2.0_x64-setup.exe\n`));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkForjaUpdate("0.1.6");

    expect(result.hasUpdate).toBe(true);
    expect(result.installUrl).toBe(exeUrl);
    expect(result.sha256).toBe(hash);
  });

  it("fails closed (no one-click install) when the sidecar is missing", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        tag_name: "v0.2.0",
        html_url: "https://github.com/MrMaia/forja/releases/tag/v0.2.0",
        assets: [{ name: "Forja_0.2.0_x64-setup.exe", browser_download_url: exeUrl }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkForjaUpdate("0.1.6");

    expect(result.hasUpdate).toBe(true); // detection still works
    expect(result.installUrl).toBeNull();
    expect(result.sha256).toBeNull();
  });

  it("fails closed when the sidecar content isn't a valid 64-char hex hash", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          tag_name: "v0.2.0",
          assets: [
            { name: "Forja_0.2.0_x64-setup.exe", browser_download_url: exeUrl },
            { name: "Forja_0.2.0_x64-setup.exe.sha256", browser_download_url: sidecarUrl },
          ],
        })
      )
      .mockResolvedValueOnce(textResponse("not-a-hash"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkForjaUpdate("0.1.6");

    expect(result.installUrl).toBeNull();
    expect(result.sha256).toBeNull();
  });
});
