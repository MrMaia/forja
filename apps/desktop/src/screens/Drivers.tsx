import { useEffect, useState } from "react";
import { useForja } from "../store";
import { TitleBar, Chevron, AmberButton } from "../components/ui";
import {
  detectNetwork,
  openExternal,
  windowsRelease,
  installWifiDriver,
  type NetworkInfo,
} from "../tauri";

// Official support pages by PC maker (best-effort; falls back to a search).
const MAKER_SUPPORT: { match: string; url: string }[] = [
  { match: "lenovo", url: "https://support.lenovo.com" },
  { match: "acer", url: "https://www.acer.com/support" },
  { match: "dell", url: "https://www.dell.com/support/home" },
  { match: "hp", url: "https://support.hp.com" },
  { match: "hewlett", url: "https://support.hp.com" },
  { match: "asus", url: "https://www.asus.com/support/" },
  { match: "msi", url: "https://www.msi.com/support" },
  { match: "gigabyte", url: "https://www.gigabyte.com/Support" },
  { match: "samsung", url: "https://www.samsung.com/br/support/" },
  { match: "positivo", url: "https://www.meupositivo.com.br/suporte/" },
  { match: "asrock", url: "https://www.asrock.com/support/" },
];

function makerUrl(manufacturer: string, model: string): string {
  const m = manufacturer.toLowerCase();
  const hit = MAKER_SUPPORT.find((x) => m.includes(x.match));
  if (hit) return hit.url;
  return `https://www.google.com/search?q=${encodeURIComponent(`${manufacturer} ${model} driver de rede`)}`;
}

type DriverState = "idle" | "installing" | "done" | "error";

export default function Drivers() {
  const { go, t } = useForja();
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [release, setRelease] = useState<"10" | "11" | null>(null);
  const [driver, setDriver] = useState<DriverState>("idle");

  useEffect(() => {
    detectNetwork()
      .then(setInfo)
      .finally(() => setLoading(false));
    void windowsRelease().then(setRelease);
  }, []);

  const installDriver = async () => {
    setDriver("installing");
    try {
      await installWifiDriver();
      setDriver("done");
    } catch {
      setDriver("error");
    }
  };

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section={t("nav.drivers")} onBack={() => go("catalog")} />
      <div className="flex-1 overflow-y-auto px-9 py-8">
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">{t("nav.drivers")}</h1>
        <p className="mt-2 max-w-[640px] text-[13.5px] leading-[1.6] text-forge-muted">
          {t("drivers.intro")}
        </p>

        {/* bundled Intel Wi-Fi driver — only on Windows 10/11 */}
        {(release === "10" || release === "11") && (
          <div className="mt-6 max-w-[680px] rounded-[13px] border border-amber-glow/30 bg-amber-glow/[0.05] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-[11px] bg-[#2e4660] font-mono text-[13px] font-semibold text-[#d3e1f0]">
                Wi
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15.5px] font-semibold">{t("drivers.intelTitle")}</div>
                <p className="mt-1 text-[12.5px] leading-[1.5] text-forge-muted">
                  {t("drivers.intelDesc")}
                </p>
                <p className="mt-1.5 font-mono text-[11px] text-forge-faint">
                  {t("drivers.winDetected", { v: release })} · {t("drivers.needsAdmin")}
                </p>
                <div className="mt-3.5">
                  {driver === "done" ? (
                    <span className="flex items-center gap-2 text-[13px] font-medium text-status-done">
                      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-status-done/[0.16] text-[11px]">
                        ✓
                      </span>
                      {t("drivers.installed")}
                    </span>
                  ) : driver === "error" ? (
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-medium text-status-error">
                        {t("drivers.failed")}
                      </span>
                      <button
                        onClick={installDriver}
                        className="rounded-[8px] border border-white/15 px-3 py-1.5 text-[12.5px] font-medium text-forge-muted transition-colors hover:border-white/25 hover:text-forge-text"
                      >
                        {t("card.retry")}
                      </button>
                    </div>
                  ) : (
                    <AmberButton
                      className="px-5 py-2.5 text-[13px] shadow-none disabled:opacity-60"
                      onClick={installDriver}
                    >
                      {driver === "installing" ? t("drivers.installing") : t("drivers.install")}
                    </AmberButton>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-8 font-mono text-sm text-forge-faint">{t("drivers.detecting")}</div>
        ) : !info ? (
          <div className="mt-8 font-mono text-sm text-status-error">{t("drivers.failDetect")}</div>
        ) : (
          <>
            <div className="mt-6 rounded-[13px] border border-white/[0.07] bg-[#1a1613] p-5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint">
                {t("drivers.thisPc")}
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">
                {info.manufacturer || "PC"} {info.model && `· ${info.model}`}
              </div>
              <button
                onClick={() => openExternal(makerUrl(info.manufacturer, info.model))}
                className="mt-3 inline-flex items-center gap-1.5 rounded-[9px] border border-amber-glow/40 bg-amber-glow/[0.12] px-3.5 py-2 text-[12.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20"
              >
                {t("drivers.makerSite")}
                <Chevron dir="right" size={13} />
              </button>
            </div>

            {info.missing.length > 0 && (
              <div className="mt-4 rounded-[13px] border border-status-error/40 bg-status-error/[0.08] p-5">
                <div className="text-[13.5px] font-semibold text-status-error">
                  {t("drivers.missingTitle")}
                </div>
                <ul className="mt-2 list-inside list-disc text-[12.5px] text-[#e2b8b2]">
                  {info.missing.map((d, i) => (
                    <li key={i}>{d.Name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint">
              {t("drivers.detected")}
            </div>
            <div className="flex flex-col gap-2">
              {info.adapters.length === 0 && (
                <div className="text-[12.5px] text-forge-faint">{t("drivers.noneDetected")}</div>
              )}
              {info.adapters.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-[11px] border border-white/[0.06] bg-[#1a1613] px-4 py-3"
                >
                  <span className="text-[13.5px]">{a.Name}</span>
                  <span
                    className={
                      "flex-shrink-0 font-mono text-[11px] " +
                      (a.NetConnectionStatus === 2 ? "text-status-done" : "text-forge-faint")
                    }
                  >
                    {a.NetConnectionStatus === 2 ? t("drivers.connected") : t("drivers.noConn")}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
