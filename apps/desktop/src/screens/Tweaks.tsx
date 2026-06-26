import { useEffect, useState } from "react";
import { useForja } from "../store";
import { TitleBar } from "../components/ui";
import {
  readTweaks,
  applyUserTweak,
  applyAdminTweaks,
  restartExplorer,
  type TweakState,
} from "../tauri";

type Tweak = { key: string; label: string; desc: string };

const USER_TWEAKS: Tweak[] = [
  { key: "dark-theme", label: "Tema escuro", desc: "Apps e sistema no escuro." },
  { key: "file-ext", label: "Mostrar extensões de arquivos", desc: "Exibe .exe, .txt, etc." },
  { key: "hidden-files", label: "Mostrar arquivos ocultos", desc: "Exibe itens ocultos no Explorer." },
  { key: "taskbar-left", label: "Barra de tarefas à esquerda", desc: "Alinha os ícones à esquerda (Win11)." },
  { key: "hide-widgets", label: "Ocultar Widgets", desc: "Remove o botão de widgets da barra." },
  { key: "hide-chat", label: "Ocultar Chat/Copilot", desc: "Remove o botão de chat da barra." },
  { key: "explorer-thispc", label: "Explorer abrir em 'Este Computador'", desc: "Em vez do Acesso rápido." },
  { key: "bing-off", label: "Desativar Bing na busca", desc: "Tira a web da busca do menu Iniciar." },
];

const ADMIN_TWEAKS: Tweak[] = [
  { key: "telemetry-off", label: "Desativar telemetria", desc: "Reduz a coleta de dados (serviço DiagTrack)." },
  { key: "consumer-off", label: "Desativar apps sugeridos", desc: "Bloqueia instalações/sugestões automáticas." },
  { key: "power-high", label: "Plano de energia: Alto desempenho", desc: "Prioriza desempenho." },
  { key: "hibernate-off", label: "Desativar hibernação", desc: "Libera espaço (apaga o hiberfil.sys)." },
];

const NEEDS_EXPLORER = new Set([
  "file-ext", "hidden-files", "taskbar-left", "hide-widgets", "hide-chat", "explorer-thispc",
]);

export default function Tweaks() {
  const { go } = useForja();
  const [state, setState] = useState<TweakState>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // user tweak being applied
  const [admin, setAdmin] = useState<Record<string, boolean>>({}); // desired admin state
  const [applyingAdmin, setApplyingAdmin] = useState(false);
  const [explorerDirty, setExplorerDirty] = useState(false);

  const load = async () => {
    const s = await readTweaks();
    setState(s);
    setAdmin(Object.fromEntries(ADMIN_TWEAKS.map((t) => [t.key, !!s[t.key]])));
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  const toggleUser = async (key: string) => {
    const next = !state[key];
    setBusy(key);
    try {
      await applyUserTweak(key, next);
      setState((p) => ({ ...p, [key]: next }));
      if (NEEDS_EXPLORER.has(key)) setExplorerDirty(true);
    } finally {
      setBusy(null);
    }
  };

  const adminChanged = ADMIN_TWEAKS.filter((t) => admin[t.key] !== !!state[t.key]);

  const applyAdmin = async () => {
    if (adminChanged.length === 0) return;
    setApplyingAdmin(true);
    try {
      await applyAdminTweaks(adminChanged.map((t) => ({ key: t.key, on: admin[t.key] })));
      await load();
    } finally {
      setApplyingAdmin(false);
    }
  };

  const doRestartExplorer = async () => {
    await restartExplorer();
    setExplorerDirty(false);
  };

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section="Ajustes do Windows" onBack={() => go("catalog")} />
      <div className="flex-1 overflow-y-auto px-9 py-8">
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">Ajustes do Windows</h1>
        <p className="mt-2 max-w-[640px] text-[13.5px] leading-[1.6] text-forge-muted">
          Ajustes comuns pós-formatação. Tudo é reversível (basta desligar de novo).
        </p>

        {explorerDirty && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-[12px] border border-amber-glow/40 bg-amber-glow/[0.08] px-4 py-3">
            <span className="text-[12.5px] text-amber-light">
              Alguns ajustes só aparecem após reiniciar o Explorer.
            </span>
            <button
              onClick={doRestartExplorer}
              className="flex-shrink-0 rounded-[8px] border border-amber-glow/40 bg-amber-glow/[0.12] px-3 py-1.5 text-[12px] font-semibold text-amber-soft hover:bg-amber-glow/20"
            >
              Reiniciar Explorer
            </button>
          </div>
        )}

        {loading ? (
          <div className="mt-8 font-mono text-sm text-forge-faint">lendo configurações…</div>
        ) : (
          <>
            <SectionTitle>Sem administrador</SectionTitle>
            <div className="overflow-hidden rounded-[13px] border border-white/[0.07] bg-[#1a1613]">
              {USER_TWEAKS.map((t) => (
                <ToggleRow
                  key={t.key}
                  label={t.label}
                  desc={t.desc}
                  checked={!!state[t.key]}
                  busy={busy === t.key}
                  onChange={() => toggleUser(t.key)}
                />
              ))}
            </div>

            <div className="mt-7 flex items-center justify-between">
              <SectionTitle>Requer administrador</SectionTitle>
              <button
                onClick={applyAdmin}
                disabled={adminChanged.length === 0 || applyingAdmin}
                className="rounded-[9px] border border-amber-glow/40 bg-amber-glow/[0.12] px-4 py-2 text-[12.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20 disabled:opacity-40"
              >
                {applyingAdmin
                  ? "aplicando…"
                  : adminChanged.length > 0
                    ? `Aplicar ${adminChanged.length} (admin)`
                    : "Aplicar (admin)"}
              </button>
            </div>
            <div className="overflow-hidden rounded-[13px] border border-white/[0.07] bg-[#1a1613]">
              {ADMIN_TWEAKS.map((t) => (
                <ToggleRow
                  key={t.key}
                  label={t.label}
                  desc={t.desc}
                  checked={!!admin[t.key]}
                  pending={admin[t.key] !== !!state[t.key]}
                  onChange={() => setAdmin((p) => ({ ...p, [t.key]: !p[t.key] }))}
                />
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-forge-faint">
              Os ajustes de administrador são aplicados juntos, com um pedido de permissão (UAC).
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-7 font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint first:mt-0">
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
  busy = false,
  pending = false,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  busy?: boolean;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-white/[0.05] px-5 py-[14px] last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[14px] font-medium">
          {label}
          {pending && (
            <span className="rounded-full bg-amber-glow/20 px-2 py-px text-[10px] font-semibold text-amber-soft">
              pendente
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[12.5px] leading-[1.45] text-forge-muted">{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={busy}
        className={
          "relative h-[24px] w-[42px] flex-shrink-0 rounded-full transition-colors disabled:opacity-50 " +
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
    </div>
  );
}
