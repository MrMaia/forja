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
    </div>
  );
}

function PresetCard({
  preset,
  featured,
  byId,
  onUse,
}: {
  preset: Preset;
  featured: boolean;
  byId: (id: string) => Program | undefined;
  onUse: () => void;
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
      <div className="mt-auto flex items-center justify-between pt-4">
        <span className="font-mono text-[12px] text-forge-muted">
          {preset.programIds.length} {t("catalog.programs")}
        </span>
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
  );
}
