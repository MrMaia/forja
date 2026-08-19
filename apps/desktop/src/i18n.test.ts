import { describe, expect, it } from "vitest";
import { pt, en } from "./i18n";

// CLAUDE.md: "pt e en devem ter as MESMAS chaves. Esquecer o en é um bug."
describe("i18n key parity", () => {
  it("has every pt key in en", () => {
    const missing = Object.keys(pt).filter((k) => !(k in en));
    expect(missing).toEqual([]);
  });

  it("has no extra keys in en beyond pt", () => {
    const extra = Object.keys(en).filter((k) => !(k in pt));
    expect(extra).toEqual([]);
  });

  it("has no empty translations", () => {
    const emptyPt = Object.entries(pt).filter(([, v]) => !v.trim());
    const emptyEn = Object.entries(en).filter(([, v]) => !v.trim());
    expect(emptyPt).toEqual([]);
    expect(emptyEn).toEqual([]);
  });
});
