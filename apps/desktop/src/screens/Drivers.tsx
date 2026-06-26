import { useEffect, useState } from "react";
import { useForja } from "../store";
import { TitleBar, Chevron } from "../components/ui";
import { detectNetwork, openExternal, type NetworkInfo } from "../tauri";

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

// Driver download by network-chip vendor (read from the adapter name).
const CHIP_DRIVER: { match: string; label: string; url: string }[] = [
  { match: "intel", label: "Driver Intel (Wi-Fi / LAN)", url: "https://www.intel.com/content/www/us/en/download-center/home.html" },
  { match: "realtek", label: "Driver Realtek (LAN/Wi-Fi)", url: "https://www.realtek.com/Download/List?cate_id=584" },
  { match: "killer", label: "Driver Killer/Qualcomm", url: "https://www.killernetworking.com/driver-downloads/" },
  { match: "qualcomm", label: "Driver Qualcomm Atheros", url: "https://www.qualcomm.com/support" },
  { match: "mediatek", label: "Driver MediaTek", url: "https://www.mediatek.com/products/connectivity-and-networking" },
  { match: "broadcom", label: "Driver Broadcom", url: "https://www.broadcom.com/support/download-search" },
];

function makerUrl(manufacturer: string, model: string): string {
  const m = manufacturer.toLowerCase();
  const hit = MAKER_SUPPORT.find((x) => m.includes(x.match));
  if (hit) return hit.url;
  return `https://www.google.com/search?q=${encodeURIComponent(`${manufacturer} ${model} driver de rede`)}`;
}

function chipDrivers(adapters: { Name: string }[]) {
  const out: { label: string; url: string }[] = [];
  for (const d of CHIP_DRIVER) {
    if (adapters.some((a) => a.Name.toLowerCase().includes(d.match)) && !out.some((o) => o.url === d.url)) {
      out.push({ label: d.label, url: d.url });
    }
  }
  return out;
}

export default function Drivers() {
  const { go } = useForja();
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    detectNetwork()
      .then(setInfo)
      .finally(() => setLoading(false));
  }, []);

  const drivers = info ? chipDrivers(info.adapters) : [];

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section="Drivers de rede" onBack={() => go("catalog")} />
      <div className="flex-1 overflow-y-auto px-9 py-8">
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">Drivers de rede</h1>
        <p className="mt-2 max-w-[640px] text-[13.5px] leading-[1.6] text-forge-muted">
          Sem internet a Forja (como o winget) não consegue baixar nada. Então aqui
          ela <strong>detecta seu hardware</strong> e te leva ao driver oficial certo —
          baixe num pendrive por outro dispositivo e instale no PC recém-formatado.
        </p>

        {loading ? (
          <div className="mt-8 font-mono text-sm text-forge-faint">detectando hardware…</div>
        ) : !info ? (
          <div className="mt-8 font-mono text-sm text-status-error">
            não foi possível detectar o hardware.
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-[13px] border border-white/[0.07] bg-[#1a1613] p-5">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint">
                Este computador
              </div>
              <div className="mt-1.5 text-[16px] font-semibold">
                {info.manufacturer || "PC"} {info.model && `· ${info.model}`}
              </div>
              <button
                onClick={() => openExternal(makerUrl(info.manufacturer, info.model))}
                className="mt-3 inline-flex items-center gap-1.5 rounded-[9px] border border-amber-glow/40 bg-amber-glow/[0.12] px-3.5 py-2 text-[12.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20"
              >
                Site de suporte do fabricante
                <Chevron dir="right" size={13} />
              </button>
            </div>

            {info.missing.length > 0 && (
              <div className="mt-4 rounded-[13px] border border-status-error/40 bg-status-error/[0.08] p-5">
                <div className="text-[13.5px] font-semibold text-status-error">
                  Dispositivos de rede sem driver
                </div>
                <ul className="mt-2 list-inside list-disc text-[12.5px] text-[#e2b8b2]">
                  {info.missing.map((d, i) => (
                    <li key={i}>{d.Name}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint">
              Placas de rede detectadas
            </div>
            <div className="flex flex-col gap-2">
              {info.adapters.length === 0 && (
                <div className="text-[12.5px] text-forge-faint">nenhuma placa física detectada.</div>
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
                    {a.NetConnectionStatus === 2 ? "conectada" : "sem conexão"}
                  </span>
                </div>
              ))}
            </div>

            {drivers.length > 0 && (
              <>
                <div className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint">
                  Baixar driver oficial
                </div>
                <div className="flex flex-wrap gap-2">
                  {drivers.map((d) => (
                    <button
                      key={d.url}
                      onClick={() => openExternal(d.url)}
                      className="inline-flex items-center gap-1.5 rounded-[9px] border border-white/15 px-3.5 py-2 text-[12.5px] font-medium text-forge-muted transition-colors hover:border-white/25 hover:text-forge-text"
                    >
                      {d.label}
                      <Chevron dir="right" size={13} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
