import { useForja } from "../store";
import { TitleBar, Diamond, Chevron } from "../components/ui";

export default function Home() {
  const {
    catalog,
    go,
    installedOf,
    pathOf,
    updatesCount,
    settings,
    checking,
    refreshInstalled,
  } = useForja();

  const installedCount = catalog.filter(
    (p) => installedOf(p.id)?.installed || pathOf(p.id)?.installed
  ).length;

  const stats: [string, number | string][] = [
    ["no catálogo", catalog.length],
    ["instalados", installedCount],
    ["com atualização", updatesCount],
  ];

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section="Início" />
      <div className="flex-1 overflow-y-auto px-9 py-8">
        {/* hero */}
        <div className="mb-7 flex items-center gap-4">
          <Diamond size={38} />
          <div>
            <h1 className="m-0 text-[26px] font-bold tracking-[-0.02em]">
              Bem-vindo à Forja
            </h1>
            <p className="mt-1 text-[14px] text-forge-muted">
              Do zero ao pronto — escolha, baixe e instale tudo de uma vez.
            </p>
          </div>
        </div>

        {/* update banner */}
        {settings.autoUpdateCheck && updatesCount > 0 && (
          <button
            onClick={() => go("catalog")}
            className="mb-6 flex w-full items-center gap-3.5 rounded-[13px] border border-amber-glow/40 px-5 py-4 text-left transition-colors hover:bg-amber-glow/[0.06]"
            style={{
              background:
                "linear-gradient(90deg,rgba(245,147,63,0.12),rgba(245,147,63,0.02))",
            }}
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-glow/20 font-mono text-[15px] font-bold text-amber-soft">
              {updatesCount}
            </span>
            <div className="flex-1">
              <div className="text-[14px] font-semibold text-amber-light">
                {updatesCount === 1
                  ? "1 programa tem atualização disponível"
                  : `${updatesCount} programas têm atualização disponível`}
              </div>
              <div className="mt-0.5 text-[12.5px] text-[#bcb2a5]">
                Veja no catálogo e atualize com um clique.
              </div>
            </div>
            <span className="text-amber-light">
              <Chevron dir="right" size={16} />
            </span>
          </button>
        )}

        {/* stats */}
        <div className="mb-7 grid grid-cols-3 gap-3.5">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className="rounded-[13px] border border-white/[0.06] bg-[#1a1613] px-5 py-[18px]"
            >
              <div className="font-mono text-[28px] font-bold leading-none text-amber-light">
                {value}
              </div>
              <div className="mt-2 text-[12.5px] text-forge-muted">{label}</div>
            </div>
          ))}
        </div>

        {/* quick actions */}
        <div className="mb-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint">
          Atalhos
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <ActionCard
            title="Explorar catálogo"
            desc="Escolha programa por programa."
            onClick={() => go("catalog")}
            primary
          />
          <ActionCard
            title="Perfis prontos"
            desc="Pacotes por tipo de uso (Dev, Gamer…)."
            onClick={() => go("presets")}
          />
          <ActionCard
            title="Exportar / Importar"
            desc="Salve a seleção num arquivo .forja."
            onClick={() => go("profiles")}
          />
          <ActionCard
            title="Configurações"
            desc="Atualizações, catálogo e mais."
            onClick={() => go("settings")}
          />
        </div>

        <button
          onClick={() => refreshInstalled()}
          disabled={checking}
          className="mt-6 text-[12.5px] font-medium text-amber-light hover:underline disabled:opacity-50"
        >
          {checking ? "verificando…" : "Verificar atualizações agora"}
        </button>
      </div>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  onClick,
  primary = false,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "group flex items-center justify-between gap-3 rounded-[13px] border p-5 text-left transition-colors " +
        (primary
          ? "border-amber-glow/40 bg-amber-glow/[0.08] hover:bg-amber-glow/[0.12]"
          : "border-white/[0.07] bg-[#1a1613] hover:border-white/[0.16]")
      }
    >
      <div>
        <div className="text-[15px] font-semibold">{title}</div>
        <div className="mt-1 text-[12.5px] text-forge-muted">{desc}</div>
      </div>
      <span className="text-forge-dim transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-amber-light">
        <Chevron dir="right" size={15} />
      </span>
    </button>
  );
}
