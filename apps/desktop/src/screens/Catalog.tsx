import { useMemo, useState } from "react";
import type { Program } from "@forja/catalog";
import { useForja } from "../store";
import { TitleBar, AppIcon, AmberButton, Chevron } from "../components/ui";
import { openExternal, type InstalledInfo } from "../tauri";

const CATEGORIES = [
  "Essenciais",
  "Navegadores",
  "Comunicação",
  "Mídia",
  "Produtividade",
  "Desenvolvimento",
  "Games",
  "Drivers",
  "Segurança",
] as const;

const DOT: Record<string, string> = {
  Essenciais: "#7d7368",
  Navegadores: "#5b7d8a",
  Comunicação: "#7d6a8a",
  Mídia: "#8a6a5b",
  Produtividade: "#6a8a5b",
  Desenvolvimento: "#f5933f",
  Games: "#8a5b6a",
  Drivers: "#7d7368",
  Segurança: "#5b8a7d",
};

export default function Catalog() {
  const {
    catalog,
    selected,
    toggle,
    clear,
    go,
    installedOf,
    selectedPrograms,
    startInstall,
    installing,
  } = useForja();
  const [active, setActive] = useState<string>("Desenvolvimento");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of catalog) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [catalog]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (q) {
      return catalog.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }
    return catalog.filter((p) => p.category === active);
  }, [catalog, active, q]);

  const heading = q ? `Resultados para "${query}"` : active;

  const selectAllVisible = () => {
    // only programs that aren't already installed can be selected
    const selectable = visible.filter((p) => !installedOf(p.id)?.installed);
    const allSelected = selectable.every((p) => selected.has(p.id));
    selectable.forEach((p) => {
      if (allSelected === selected.has(p.id)) toggle(p.id);
    });
  };

  // ~size estimate is cosmetic: rough 0.17 GB per program.
  const sizeGb = (selected.size * 0.17).toFixed(1).replace(".", ",");

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section="Catálogo" />
      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className="flex w-[236px] flex-shrink-0 flex-col border-r border-white/5 bg-forge-inset px-3.5 py-[18px]">
          <div className="mb-3 px-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint">
            Categorias
          </div>
          <div className="flex flex-col gap-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = !q && cat === active;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setQuery("");
                    setActive(cat);
                  }}
                  className={
                    "relative flex items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-left transition-colors " +
                    (isActive
                      ? "bg-amber-glow/10 text-amber-light"
                      : "text-forge-muted hover:bg-white/[0.04]")
                  }
                >
                  {isActive && (
                    <span className="absolute bottom-[9px] left-0 top-[9px] w-[3px] rounded-[2px] bg-amber-glow" />
                  )}
                  <span
                    className="h-2 w-2 rounded-[2px]"
                    style={{ background: DOT[cat] }}
                  />
                  <span className={"flex-1 text-[13px] " + (isActive ? "font-semibold" : "")}>
                    {cat}
                  </span>
                  <span
                    className={
                      "font-mono text-[11px] " +
                      (isActive
                        ? "rounded-full bg-amber-glow/20 px-[7px] py-px text-amber-soft"
                        : "text-forge-faint")
                    }
                  >
                    {counts.get(cat) ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex flex-col gap-0.5 border-t border-white/[0.06] pt-3">
            <SidebarLink
              label="Instalações"
              onClick={() => go("install")}
              badge={installing ? "•" : undefined}
            />
            <SidebarLink label="Perfis prontos" onClick={() => go("presets")} />
            <SidebarLink label="Exportar / Importar" onClick={() => go("profiles")} />
          </div>
        </aside>

        {/* main */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[62px] flex-shrink-0 items-center gap-3 border-b border-white/5 px-6">
            <div className="flex max-w-[440px] flex-1 items-center gap-2.5 rounded-[10px] border border-white/[0.08] bg-[#1a1613] px-3.5 py-2.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="5" stroke="#6f665c" strokeWidth="1.5" />
                <line x1="11" y1="11" x2="14.5" y2="14.5" stroke="#6f665c" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar programas…"
                className="w-full bg-transparent text-[13.5px] text-forge-text outline-none placeholder:text-forge-faint"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="mb-4 flex items-baseline justify-between">
              <div className="flex items-baseline gap-[11px]">
                <span className="text-[18px] font-semibold">{heading}</span>
                <span className="font-mono text-[12px] text-forge-faint">
                  {visible.length} programas
                </span>
              </div>
              {visible.length > 0 && (
                <button
                  onClick={selectAllVisible}
                  className="text-[12.5px] font-medium text-amber-light hover:underline"
                >
                  Selecionar todos
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3.5">
              {visible.map((p) => (
                <ProgramCard
                  key={p.id}
                  program={p}
                  selected={selected.has(p.id)}
                  onToggle={() => toggle(p.id)}
                  info={installedOf(p.id)}
                />
              ))}
            </div>
            {visible.length === 0 && (
              <div className="mt-20 text-center font-mono text-sm text-forge-faint">
                nenhum programa encontrado
              </div>
            )}
          </div>
        </section>
      </div>

      {/* footer action bar */}
      <div className="flex h-[74px] flex-shrink-0 items-center justify-between border-t border-white/[0.06] bg-forge-deep px-6">
        <div className="flex items-center gap-[13px]">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-amber-glow/[0.14] font-mono text-[15px] font-semibold text-amber-soft">
            {selected.size}
          </div>
          <div className="flex flex-col leading-[1.3]">
            <span className="text-[13.5px] font-medium">itens selecionados</span>
            <span className="font-mono text-[11.5px] text-forge-faint">
              ~{sizeGb} GB para baixar
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={clear}
            disabled={selected.size === 0}
            className="rounded-[10px] border border-white/10 px-[18px] py-3 text-[13.5px] text-forge-muted transition-colors hover:border-white/20 hover:text-forge-text disabled:opacity-40"
          >
            Limpar seleção
          </button>
          <AmberButton
            className="flex items-center gap-2 px-6 py-3 text-[14px] shadow-[0_6px_18px_rgba(245,147,63,0.28)] disabled:opacity-50"
            onClick={() => {
              if (selected.size === 0) return;
              startInstall(selectedPrograms());
              go("install");
            }}
          >
            Instalar selecionados
          </AmberButton>
        </div>
      </div>
    </div>
  );
}

function ProgramCard({
  program,
  selected,
  onToggle,
  info,
}: {
  program: Program;
  selected: boolean;
  onToggle: () => void;
  info?: InstalledInfo;
}) {
  // progress comes from the global install queue (shared with the Instalações tab)
  const { installRows, startUpgrade, pathOf, addToPath, isErrorDismissed } = useForja();
  const row = installRows[program.id];
  const status = row?.status;
  const busy =
    status === "queued" || status === "downloading" || status === "installing";
  // the error stays in the global queue (Instalações tab keeps the full log), but
  // on the card it auto-dismisses after a few seconds (handled globally in the
  // store, so it stays dismissed across tab switches) — the card then falls back
  // to its normal state (e.g. "Atualizar").
  const failed = status === "error" && !isErrorDismissed(program.id);
  // installed = detected by winget OR by executable (covers installs winget misses)
  const pinfo = pathOf(program.id);
  const installed = !!info?.installed || !!pinfo?.installed;
  const outdated = !!info?.installed && !!info?.available && !busy;
  const current = installed && !info?.available && !busy && !failed;
  // CLI tool present but not on PATH → offer to add it (only for pathTool apps,
  // so GUI apps that merely have an `exe` never show the PATH button)
  const offPath =
    !!program.pathTool && !!pinfo?.installed && !pinfo.onPath && !!pinfo.pathDir;

  const [pathState, setPathState] = useState<"idle" | "adding" | "error">("idle");
  const doAddPath = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pinfo?.pathDir) return;
    setPathState("adding");
    try {
      await addToPath(program.id, pinfo.pathDir);
      setPathState("idle");
    } catch {
      setPathState("error");
    }
  };
  // installed programs can't be (re)selected — only updated. So no checkbox, and
  // the card isn't a selection toggle anymore.
  const selectable = !installed && !busy;

  const doUpgrade = (e: React.MouseEvent) => {
    e.stopPropagation();
    // upgrade the id winget actually lists (e.g. DBeaver.DBeaver.Community),
    // not the catalog install id (dbeaver.dbeaver) — they often differ.
    const target = info?.wingetId ?? program.winget;
    if (target) startUpgrade(program, target);
  };

  return (
    <div
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      onClick={selectable ? onToggle : undefined}
      onKeyDown={
        selectable
          ? (e) => (e.key === "Enter" || e.key === " ") && onToggle()
          : undefined
      }
      className={
        "flex items-start gap-3 rounded-[12px] border p-[15px] text-left transition-colors " +
        (selectable ? "cursor-pointer select-none " : "") +
        (selected
          ? "border-amber-glow/[0.55] bg-amber-glow/[0.09]"
          : installed
            ? "border-white/[0.05] bg-[#161311]"
            : "border-white/[0.06] bg-[#1a1613] hover:border-white/[0.14]")
      }
    >
      <AppIcon program={program} font={16} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-semibold">{program.name}</span>
          {/* checkbox only for selectable (not-installed) programs */}
          {selectable &&
            (selected ? (
              <span className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-from to-amber-to text-[12px] font-bold text-[#1a1109]">
                ✓
              </span>
            ) : (
              <span className="h-[22px] w-[22px] flex-shrink-0 rounded-full border-[1.5px] border-white/[0.18]" />
            ))}
        </div>
        <div className="mt-1 text-[12px] leading-[1.45] text-[#998f83]">
          {program.description}
        </div>

        {/* install / upgrade state (driven by the global queue) */}
        {busy ? (
          <div className="mt-2.5 flex items-center gap-2 text-[11.5px] text-amber-soft">
            <span
              className="h-[13px] w-[13px] rounded-full border-2 border-amber-glow/25 border-t-amber-glow"
              style={{ animation: "forjaSpin 0.8s linear infinite" }}
            />
            {status === "downloading"
              ? `baixando · ${Math.round(row?.percent ?? 0)}%`
              : status === "installing"
                ? "instalando…"
                : "na fila…"}
          </div>
        ) : failed ? (
          <div className="mt-2.5">
            <div
              className="text-[11px] font-medium leading-[1.4] text-status-error"
              title={row?.line}
            >
              {row?.line ?? "falha ao atualizar"}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={doUpgrade}
                className="rounded-[7px] border border-white/15 px-2.5 py-1 text-[11.5px] font-medium text-forge-muted transition-colors hover:border-white/25 hover:text-forge-text"
              >
                Tentar de novo
              </button>
              {program.fallbackUrl && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openExternal(program.fallbackUrl!);
                  }}
                  className="rounded-[7px] border border-white/15 px-2.5 py-1 text-[11.5px] font-medium text-forge-muted transition-colors hover:border-white/25 hover:text-forge-text"
                >
                  Abrir site oficial
                </button>
              )}
            </div>
          </div>
        ) : outdated ? (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 font-mono text-[11px] text-amber-soft">
              {info!.installed}
              <Chevron dir="right" size={11} />
              {info!.available}
            </span>
            <button
              onClick={doUpgrade}
              className="rounded-[7px] border border-amber-glow/40 bg-amber-glow/[0.12] px-2.5 py-1 text-[11.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20"
            >
              Atualizar
            </button>
          </div>
        ) : current ? (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] font-medium text-status-done">
            <span className="text-[12px]">✓</span> instalado
            {info?.installed && ` · v${info.installed}`}
          </div>
        ) : null}

        {/* dev tool installed but not on PATH → one-click add to user PATH */}
        {offPath && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <span
              className="truncate text-[11px] font-medium text-amber-soft"
              title={pathState === "error" ? "falha ao adicionar" : pinfo!.pathDir!}
            >
              {pathState === "error" ? "falha — tente de novo" : "⚠ fora do PATH"}
            </span>
            <button
              onClick={doAddPath}
              disabled={pathState === "adding"}
              className="flex-shrink-0 rounded-[7px] border border-amber-glow/40 bg-amber-glow/[0.12] px-2.5 py-1 text-[11.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20 disabled:opacity-50"
            >
              {pathState === "adding" ? "adicionando…" : "Adicionar ao PATH"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarLink({
  label,
  onClick,
  badge,
}: {
  label: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-[11px] rounded-[9px] px-[11px] py-2 text-[12.5px] text-[#8e857a] transition-colors hover:bg-white/[0.04] hover:text-[#bcb2a5]"
    >
      <span
        className={
          "h-[5px] w-[5px] rounded-full transition-colors group-hover:bg-amber-glow " +
          (badge ? "animate-pulse bg-amber-glow" : "bg-forge-faint")
        }
      />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-forge-dim transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-amber-light">
        <Chevron dir="right" size={13} />
      </span>
    </button>
  );
}
