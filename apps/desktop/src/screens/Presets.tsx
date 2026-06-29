import { useState } from "react";
import type { Preset, Program } from "@forja/catalog";
import { useForja } from "../store";
import { TitleBar, Diamond, AppIcon, AmberButton } from "../components/ui";

const ACCENT: Record<string, string> = {
  gamer: "#8a5b6a",
  office: "#5b7d8a",
  streamer: "#7d6a8a",
  estudante: "#6a8a5b",
};

export default function Presets() {
  const { presets, setSelection, go, byId, t } = useForja();
  const [preview, setPreview] = useState<Preset | null>(null);

  const use = (preset: Preset) => {
    setSelection(preset.programIds);
    go("catalog");
  };

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section={t("presets.section")} onBack={() => go("catalog")} />
      <div className="flex min-h-0 flex-1 flex-col px-9 py-[34px]">
        <div className="mb-[26px] flex items-end justify-between">
          <div>
            <h2 className="m-0 text-[26px] font-bold tracking-[-0.02em]">
              {t("presets.section")}
            </h2>
            <p className="mt-2 text-[14px] text-forge-muted">
              {t("presets.subtitle")}
            </p>
          </div>
          <button
            onClick={() => go("catalog")}
            className="text-[13px] font-medium text-amber-light hover:underline"
          >
            {t("presets.orScratch")}
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-[18px]">
          {presets.map((preset, i) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              featured={i === 0}
              byId={byId}
              onUse={() => use(preset)}
              onView={() => setPreview(preset)}
            />
          ))}
          {/* montar do zero */}
          <button
            onClick={() => go("catalog")}
            className="flex flex-col items-center justify-center gap-2.5 rounded-[14px] border-[1.5px] border-dashed border-white/[0.13] p-5 text-center transition-colors hover:border-amber-glow/50 hover:bg-amber-glow/[0.03]"
          >
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full border-[1.5px] border-white/20 text-[20px] font-light text-forge-muted">
              +
            </div>
            <span className="text-[14.5px] font-semibold">{t("presets.buildScratch")}</span>
            <span className="max-w-[180px] text-[12px] leading-[1.45] text-[#8e857a]">
              {t("presets.buildScratchDesc")}
            </span>
          </button>
        </div>
      </div>

      {preview && (
        <PreviewModal
          preset={preview}
          byId={byId}
          onClose={() => setPreview(null)}
          onEdit={(ids) => {
            setSelection(ids);
            go("catalog");
          }}
        />
      )}
    </div>
  );
}

// View + trim a preset's pre-selection before jumping into the catalog to edit.
function PreviewModal({
  preset,
  byId,
  onClose,
  onEdit,
}: {
  preset: Preset;
  byId: (id: string) => Program | undefined;
  onClose: () => void;
  onEdit: (ids: string[]) => void;
}) {
  const { t, tPreset, tDesc } = useForja();
  const [name] = tPreset(preset.id, preset.name, preset.description);
  const [chosen, setChosen] = useState<Set<string>>(new Set(preset.programIds));
  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-8"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-[460px] flex-col overflow-hidden rounded-[16px] border border-white/[0.1] bg-[#1a1613] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Diamond size={26} />
            <div>
              <div className="text-[16px] font-semibold">{name}</div>
              <div className="mt-0.5 text-[12px] text-forge-muted">
                {t("presets.previewSubtitle", { n: preset.programIds.length })}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("win.close")}
            className="-mr-1 flex h-7 w-7 items-center justify-center rounded-[7px] text-forge-faint transition-colors hover:bg-white/10 hover:text-forge-text"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {preset.programIds.map((id) => {
            const p = byId(id);
            if (!p) return null;
            const on = chosen.has(id);
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <AppIcon program={p} size={32} radius={8} font={12} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-medium">{p.name}</div>
                  <div className="truncate text-[11.5px] text-forge-muted">
                    {tDesc(p.id, p.description)}
                  </div>
                </div>
                <span
                  className={
                    "flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded-[6px] border text-[11px] " +
                    (on
                      ? "border-amber-glow/50 bg-amber-glow/[0.18] text-amber-soft"
                      : "border-white/15 text-transparent")
                  }
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3.5">
          <span className="font-mono text-[12px] text-forge-muted">
            {t("presets.selectedN", { n: chosen.size })}
          </span>
          <AmberButton
            className="px-4 py-[9px] text-[12.5px] shadow-none"
            onClick={() => onEdit([...chosen])}
          >
            {t("presets.editInCatalog")}
          </AmberButton>
        </div>
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  featured,
  byId,
  onUse,
  onView,
}: {
  preset: Preset;
  featured: boolean;
  byId: (id: string) => Program | undefined;
  onUse: () => void;
  onView: () => void;
}) {
  const { t, tPreset } = useForja();
  const [name, description] = tPreset(preset.id, preset.name, preset.description);
  const chips = preset.programIds.slice(0, 4);
  const extra = preset.programIds.length - chips.length;
  const accent = ACCENT[preset.id] ?? "#7d7368";

  return (
    <div
      className={
        "flex flex-col rounded-[14px] p-5 " +
        (featured
          ? "border border-amber-glow/50 bg-gradient-to-b from-amber-glow/[0.12] to-amber-glow/[0.03]"
          : "border border-white/[0.07] bg-[#1a1613] transition-colors hover:border-white/[0.16]")
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[11px]">
          {featured ? (
            <Diamond size={34} />
          ) : (
            <div
              className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[16px]"
              style={{ background: accent }}
            >
              ◆
            </div>
          )}
          <span className={"text-[17px] font-semibold " + (featured ? "ml-1" : "")}>
            {name}
          </span>
        </div>
        {featured && (
          <span className="rounded-full bg-amber-glow/[0.18] px-2 py-[3px] text-[10px] font-semibold tracking-[0.08em] text-amber-soft">
            {t("presets.popular")}
          </span>
        )}
      </div>
      <p className="mt-[13px] text-[12.5px] leading-[1.5] text-[#bcb2a5]">
        {description}
      </p>
      <div className="mt-4 flex gap-1.5">
        {chips.map((id) => {
          const p = byId(id);
          return p ? (
            <AppIcon key={id} program={p} size={28} radius={7} font={11} />
          ) : null;
        })}
        {extra > 0 && (
          <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] bg-white/[0.06] font-mono text-[10px] text-forge-muted">
            +{extra}
          </div>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <span className="font-mono text-[12px] text-forge-muted">
          {preset.programIds.length} {t("catalog.programs")}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onView}
            className="rounded-[9px] border border-white/[0.12] px-3 py-[9px] text-[12.5px] font-medium text-forge-muted transition-colors hover:border-white/25 hover:text-forge-text"
          >
            {t("presets.view")}
          </button>
          {featured ? (
            <AmberButton className="px-4 py-[9px] text-[12.5px] shadow-none" onClick={onUse}>
              {t("presets.use")}
            </AmberButton>
          ) : (
            <button
              onClick={onUse}
              className="rounded-[9px] border border-white/[0.12] bg-white/[0.05] px-4 py-[9px] text-[12.5px] font-medium text-forge-text transition-colors hover:bg-white/10"
            >
              {t("presets.use")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
