import { useMemo, useState } from "react";
import type { ForjaProfile } from "@forja/catalog";
import { useForja } from "../store";
import { TitleBar, Diamond, AmberButton } from "../components/ui";
import {
  buildProfile,
  exportProfile,
  importProfile,
  getRecents,
} from "../profile";

export default function Profiles() {
  const { selected, setSelection, go, byId, t, tCat, settings } = useForja();
  const [name, setName] = useState("meu-setup");
  const [recents, setRecents] = useState<ForjaProfile[]>(() => getRecents());

  const ids = useMemo(() => [...selected], [selected]);
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const id of ids) {
      const p = byId(id);
      if (p) set.add(p.category);
    }
    return [...set];
  }, [ids, byId]);

  const onExport = async () => {
    await exportProfile(buildProfile(name, ids));
    setRecents(getRecents());
  };

  const applyAndGo = (profile: ForjaProfile) => {
    setSelection(profile.programIds);
    go("catalog");
  };

  const onImportFile = async () => {
    try {
      const profile = await importProfile();
      if (profile) applyAndGo(profile);
    } catch (e) {
      alert(t("profiles.couldNotImport", { m: (e as Error).message }));
    }
  };

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section={t("profiles.section")} onBack={() => go("catalog")} />
      <div className="flex min-h-0 flex-1 flex-col px-9 py-[30px]">
        {/* banner */}
        <div
          className="mb-6 flex items-center gap-3.5 rounded-[13px] border border-amber-glow/30 px-5 py-4"
          style={{
            background:
              "linear-gradient(90deg,rgba(245,147,63,0.12),rgba(245,147,63,0.02))",
          }}
        >
          <Diamond size={30} />
          <div className="ml-1">
            <div className="text-[15px] font-semibold">
              {t("profiles.bannerTitle")}
            </div>
            <div className="mt-[3px] text-[12.5px] text-[#bcb2a5]">
              {t("profiles.banner1")}{" "}
              <span className="font-mono text-amber-soft">.forja</span>{" "}
              {t("profiles.banner2")}
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-[22px]">
          {/* export */}
          <div className="flex flex-col rounded-[14px] border border-white/[0.07] bg-[#1a1613] p-6">
            <div className="mb-1.5 flex items-center gap-[11px]">
              <ArrowIcon dir="up" />
              <span className="text-[17px] font-semibold">{t("profiles.export")}</span>
            </div>
            <p className="mb-[18px] text-[13px] leading-[1.5] text-forge-muted">
              {t("profiles.exportDesc")}
            </p>

            <div className="mb-4 rounded-[11px] border border-white/[0.06] bg-forge-bg p-[15px]">
              <div className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-forge-faint">
                {t("profiles.currentSel")}
              </div>
              <div className="mb-[13px] flex items-baseline gap-2">
                <span className="font-mono text-[24px] font-bold text-amber-light">
                  {ids.length}
                </span>
                <span className="text-[13px] text-[#bcb2a5]">
                  {t("profiles.catsSuffix", { n: categories.length })}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.slice(0, 4).map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-[3px] text-[11px] text-[#bcb2a5]"
                  >
                    {tCat(c)}
                  </span>
                ))}
                {categories.length > 4 && (
                  <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-[3px] text-[11px] text-[#8e857a]">
                    +{categories.length - 4}
                  </span>
                )}
              </div>
            </div>

            <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-forge-faint">
              {t("profiles.filename")}
            </div>
            <div className="flex items-center rounded-[10px] border border-white/10 bg-forge-bg px-3.5 py-3 font-mono text-[13.5px]">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-forge-text outline-none"
              />
              <span className="text-amber-soft">.forja</span>
            </div>

            <AmberButton
              className="mt-auto flex items-center justify-center gap-2.5 py-3.5 text-[14px] shadow-[0_6px_18px_rgba(245,147,63,0.28)] disabled:opacity-50"
              onClick={onExport}
            >
              <span className="-mt-px">↑</span> {t("profiles.export")}
            </AmberButton>
          </div>

          {/* import */}
          <div className="flex flex-col rounded-[14px] border border-white/[0.07] bg-[#1a1613] p-6">
            <div className="mb-1.5 flex items-center gap-[11px]">
              <ArrowIcon dir="down" />
              <span className="text-[17px] font-semibold">{t("profiles.import")}</span>
            </div>
            <p className="mb-[18px] text-[13px] leading-[1.5] text-forge-muted">
              {t("profiles.importDesc")}
            </p>

            <button
              onClick={onImportFile}
              className="mb-[18px] flex flex-col items-center justify-center gap-2.5 rounded-[12px] border-[1.5px] border-dashed border-amber-glow/40 bg-amber-glow/[0.04] p-[26px] text-center transition-colors hover:bg-amber-glow/[0.08]"
            >
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] bg-amber-glow/[0.14]">
                <Diamond size={18} glow={false} />
              </div>
              <div className="text-[13.5px] font-medium">
                {t("profiles.clickChoose")}{" "}
                <span className="font-mono text-amber-soft">.forja</span>
              </div>
              <div className="text-[12px] text-[#8e857a]">
                {t("profiles.dragHere")}
              </div>
            </button>

            <div className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-forge-faint">
              {t("profiles.recent")}
            </div>
            <div className="flex flex-col gap-2.5 overflow-y-auto">
              {recents.length === 0 && (
                <div className="rounded-[11px] border border-white/[0.06] bg-forge-bg px-3.5 py-3 text-[12px] text-forge-faint">
                  {t("profiles.noneYet")}
                </div>
              )}
              {recents.map((r) => (
                <div
                  key={r.name}
                  className="flex items-center gap-3 rounded-[11px] border border-white/[0.06] bg-forge-bg px-3.5 py-3 transition-colors hover:border-amber-glow/40"
                >
                  <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[8px] bg-amber-glow/10">
                    <Diamond size={13} glow={false} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[13px] text-forge-text">
                      {r.name}.forja
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-[#8e857a]">
                      {r.programIds.length}{" "}
                      {t("profiles.exportedSuffix", {
                        d: new Date(r.exportedAt).toLocaleDateString(
                          settings.lang === "pt" ? "pt-BR" : "en-US"
                        ),
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => applyAndGo(r)}
                    className="flex-shrink-0 rounded-[8px] border border-white/[0.12] bg-white/[0.05] px-3.5 py-[7px] text-[12px] font-medium text-forge-text transition-colors hover:border-amber-glow/40 hover:bg-amber-glow/[0.14] hover:text-amber-soft"
                  >
                    {t("profiles.importBtn")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArrowIcon({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
      {dir === "up" ? (
        <path
          d="M8 2v8M8 10l-3-3M8 10l3-3"
          stroke="#f5a85e"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8 11V3M8 3L5 6M8 3l3 3"
          stroke="#f5a85e"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <path d="M3 13.5h10" stroke="#f5a85e" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
