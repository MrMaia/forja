import { useEffect, useState } from "react";
import { useForja } from "../store";
import { TitleBar } from "../components/ui";
import { checkForjaUpdate, openExternal, type ForjaUpdate } from "../tauri";

const APP_VERSION = "0.1.0";

export default function Settings() {
  const { settings, updateSetting, go } = useForja();
  const [update, setUpdate] = useState<ForjaUpdate | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      setUpdate(await checkForjaUpdate(APP_VERSION));
    } finally {
      setChecking(false);
    }
  };

  // auto-check Forja's own version on open, if enabled
  useEffect(() => {
    if (settings.autoUpdateCheck) void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = () => {
    if (checking) return "verificando…";
    if (!update) return "Toque em “Verificar agora”.";
    if (update.hasUpdate) return `Nova versão ${update.latest} disponível!`;
    if (update.latest) return `Você está na versão mais recente.`;
    return "Não foi possível verificar agora (sem internet ou sem versão publicada).";
  };

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section="Configurações" onBack={() => go("catalog")} />
      <div className="flex-1 overflow-y-auto px-9 py-8">
        <h1 className="m-0 mb-7 text-[24px] font-bold tracking-[-0.02em]">
          Configurações
        </h1>

        <Section title="Atualizações da Forja">
          <Toggle
            label="Verificar atualizações ao abrir"
            desc="Checa se há uma versão nova da Forja quando o app inicia."
            checked={settings.autoUpdateCheck}
            onChange={(v) => updateSetting("autoUpdateCheck", v)}
          />
          <Row label={`Forja v${APP_VERSION}`} desc={updateStatus()}>
            {update?.hasUpdate ? (
              <button
                onClick={() => openExternal(update.url)}
                className="rounded-[9px] border border-amber-glow/40 bg-amber-glow/[0.12] px-4 py-2 text-[12.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20"
              >
                Baixar
              </button>
            ) : (
              <button
                onClick={check}
                disabled={checking}
                className="rounded-[9px] border border-white/15 px-4 py-2 text-[12.5px] font-medium text-forge-muted transition-colors hover:border-white/25 hover:text-forge-text disabled:opacity-50"
              >
                {checking ? "verificando…" : "Verificar agora"}
              </button>
            )}
          </Row>
        </Section>

        <Section title="Catálogo">
          <Toggle
            label="Ocultar programas já instalados"
            desc="Mostra só o que ainda falta instalar."
            checked={settings.hideInstalled}
            onChange={(v) => updateSetting("hideInstalled", v)}
          />
        </Section>

        <Section title="Sobre">
          <Row label="Forja — Do zero ao pronto." desc="Windows 10 / 11 · instalação via winget." />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-7">
      <div className="mb-2.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint">
        {title}
      </div>
      <div className="overflow-hidden rounded-[13px] border border-white/[0.07] bg-[#1a1613]">
        {children}
      </div>
    </div>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-white/[0.05] px-5 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">{label}</div>
        {desc && <div className="mt-0.5 text-[12.5px] leading-[1.45] text-forge-muted">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} desc={desc}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={
          "relative h-[24px] w-[42px] flex-shrink-0 rounded-full transition-colors " +
          (checked ? "bg-amber-glow/80" : "bg-white/[0.12]")
        }
      >
        <span
          className={
            "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all " +
            (checked ? "left-[21px]" : "left-[3px]")
          }
        />
      </button>
    </Row>
  );
}
