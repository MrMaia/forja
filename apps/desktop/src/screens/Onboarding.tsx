import { useForja } from "../store";
import { TitleBar, AmberButton } from "../components/ui";

const PRESET_CHIPS = ["Dev", "Gamer", "Office", "Streamer"];

export default function Onboarding() {
  const { go, t } = useForja();

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div
        className="relative flex flex-1 flex-col items-center justify-center overflow-hidden"
        style={{
          background:
            "radial-gradient(115% 80% at 50% 118%, rgba(245,147,63,0.2), rgba(245,147,63,0.04) 42%, transparent 64%), #14110f",
        }}
      >
        {/* faint grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px)",
            backgroundSize: "38px 38px",
            maskImage: "radial-gradient(70% 60% at 50% 40%,#000,transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(70% 60% at 50% 40%,#000,transparent 80%)",
          }}
        />
        {/* pulsing ember glow */}
        <div
          className="pointer-events-none absolute -bottom-24 h-[200px] w-[380px] rounded-full"
          style={{
            background:
              "radial-gradient(closest-side,rgba(245,147,63,0.5),transparent)",
            filter: "blur(38px)",
            animation: "forjaPulse 4s ease-in-out infinite",
          }}
        />

        <div className="relative flex flex-col items-center px-10 text-center">
          <div
            className="mb-[34px] h-[62px] w-[62px] rounded-[15px]"
            style={{
              transform: "rotate(45deg)",
              background: "linear-gradient(135deg,#ffbd7a,#e8792b)",
              boxShadow:
                "0 0 36px rgba(245,147,63,0.5),inset 0 2px 8px rgba(255,255,255,0.35)",
            }}
          />
          <div className="text-[58px] font-bold leading-none tracking-[-0.03em]">
            Forja
          </div>
          <div className="mt-3.5 text-[21px] font-medium text-amber-light">
            {t("onboarding.tagline")}
          </div>
          <p className="mt-[18px] max-w-[540px] text-[15px] leading-[1.65] text-forge-muted">
            {t("onboarding.desc")}
          </p>
          <div className="mt-[34px] flex gap-3.5">
            <AmberButton className="px-7 py-3.5 text-[14.5px]" onClick={() => go("catalog")}>
              {t("onboarding.build")}
            </AmberButton>
            <button
              onClick={() => go("presets")}
              className="rounded-[11px] border border-white/[0.13] bg-white/[0.04] px-[26px] py-3.5 text-[14.5px] font-medium text-forge-text transition-colors hover:bg-white/[0.08]"
            >
              {t("onboarding.choosePreset")}
            </button>
          </div>
          <div className="mt-11 flex items-center gap-2.5">
            <span className="font-mono text-[11px] text-forge-faint">
              {t("onboarding.orProfile")}
            </span>
            <div className="flex gap-2">
              {PRESET_CHIPS.map((c) => (
                <button
                  key={c}
                  onClick={() => go("presets")}
                  className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-[5px] text-[11.5px] text-[#bcb2a5] transition-colors hover:border-amber-light/40 hover:text-amber-light"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-[26px] font-mono text-[11px] text-forge-dim">
          {t("onboarding.footer")}
        </div>
      </div>
    </div>
  );
}
