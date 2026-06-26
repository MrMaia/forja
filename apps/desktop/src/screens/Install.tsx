import { useEffect, useState } from "react";
import type { InstallStatus, Program } from "@forja/catalog";
import { useForja, type InstallRow } from "../store";
import { TitleBar, AppIcon } from "../components/ui";
import { openExternal } from "../tauri";

const TERMINAL: InstallStatus[] = ["done", "error", "skipped"];

// "1m 23s" / "12s" from a start timestamp.
function elapsed(startedAt?: number, now = Date.now()): string {
  if (!startedAt) return "";
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

// Smooth per-item contribution to the overall bar.
function itemPct(row?: InstallRow): number {
  const s = row?.status;
  if (!s || s === "queued") return 0;
  if (s === "downloading") return Math.min(90, (row?.percent ?? 0) * 0.9);
  if (s === "installing") return 95;
  return 100; // done | error | skipped
}

export default function Install() {
  const { installQueue: programs, installRows: rows, installing, go } = useForja();

  // tick once a second while something is installing, so the per-item timers move
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!installing) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [installing]);

  const total = programs.length;
  const done = programs.filter((p) => rows[p.id]?.status === "done").length;
  const errors = programs.filter((p) => rows[p.id]?.status === "error").length;
  const finished =
    total > 0 && programs.every((p) => TERMINAL.includes(rows[p.id]?.status));
  const pct = total
    ? Math.round(programs.reduce((a, p) => a + itemPct(rows[p.id]), 0) / total)
    : 0;

  if (total === 0) {
    return (
      <div className="flex h-full flex-col bg-forge-bg">
        <TitleBar section="Instalações" onBack={() => go("catalog")} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="font-mono text-sm text-forge-faint">
            nenhuma instalação em andamento
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section={finished ? "Concluído" : "Instalando"} onBack={() => go("catalog")} />

      {/* overall progress */}
      <div className="flex-shrink-0 border-b border-white/5 px-8 pb-[22px] pt-7">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="m-0 text-[21px] font-bold tracking-[-0.01em]">
              {finished ? "Setup forjado" : "Forjando seu setup"}
            </h2>
            <p className="mt-[7px] font-mono text-[12.5px] text-forge-muted">
              {done} de {total} concluídos
              {installing && " · em andamento"}
              {errors > 0 && ` · ${errors} erro${errors > 1 ? "s" : ""}`}
            </p>
          </div>
          <span className="font-mono text-[30px] font-semibold leading-none text-amber-light">
            {pct}
            <span className="text-[18px] text-[#a3724a]">%</span>
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-[5px] bg-white/[0.07]">
          <div
            className="h-full rounded-[5px] bg-gradient-to-r from-amber-to to-[#ffb066] shadow-[0_0_12px_rgba(245,147,63,0.5)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* queue */}
      <div className="flex flex-1 flex-col gap-[3px] overflow-y-auto px-6 py-3.5">
        {programs.map((p) => (
          <QueueRow key={p.id} program={p} row={rows[p.id]} now={now} />
        ))}
      </div>

      {/* footer */}
      <div className="flex h-[68px] flex-shrink-0 items-center border-t border-white/[0.06] bg-forge-deep px-6">
        <Legend />
      </div>
    </div>
  );
}

function QueueRow({
  program,
  row,
  now,
}: {
  program: Program;
  row?: InstallRow;
  now: number;
}) {
  const status = row?.status ?? "queued";
  const downloading = status === "downloading";
  const installingNow = status === "installing";
  const active = downloading || installingNow;
  const failed = status === "error";
  const barPct = downloading ? Math.round(row?.percent ?? 0) : 0;
  const time = elapsed(row?.startedAt, now);

  return (
    <div
      className={
        "flex items-center gap-3.5 rounded-[10px] px-3 py-[11px] " +
        (active ? "border border-amber-glow/25 bg-amber-glow/[0.07]" : "")
      }
    >
      <AppIcon program={program} size={38} radius={9} font={13} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-medium">{program.name}</span>
          {active && (
            <span className="flex-shrink-0 font-mono text-[11.5px] text-amber-soft">
              {downloading ? `baixando · ${barPct}%` : "instalando"}
              {time && <span className="ml-1.5 text-forge-faint">· {time}</span>}
            </span>
          )}
        </div>
        {active && (
          <div className="mt-2 h-[4px] overflow-hidden rounded-[3px] bg-white/[0.08]">
            {downloading ? (
              <div
                className="h-full rounded-[3px] bg-amber-glow transition-[width] duration-200"
                style={{ width: `${barPct}%` }}
              />
            ) : (
              // installing: winget gives no %, so sweep an indeterminate highlight
              <div
                className="h-full w-2/5 rounded-[3px] bg-amber-glow/80"
                style={{ animation: "forjaIndeterminate 1.3s ease-in-out infinite" }}
              />
            )}
          </div>
        )}
        {/* live winget line while active; the failure reason when it errors */}
        {(active || failed) && row?.line && (
          <div
            className={
              "mt-1.5 truncate font-mono text-[10.5px] " +
              (failed ? "text-status-error/90" : "text-forge-faint")
            }
            title={row.line}
          >
            {row.line}
          </div>
        )}
      </div>
      <StatusBadge status={status} fallbackUrl={program.fallbackUrl} />
    </div>
  );
}

function StatusBadge({
  status,
  fallbackUrl,
}: {
  status: InstallStatus;
  fallbackUrl: string | null;
}) {
  if (status === "done")
    return (
      <span className="flex items-center gap-[7px] text-[12.5px] font-medium text-status-done">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-status-done/[0.16] text-[11px]">
          ✓
        </span>
        Concluído
      </span>
    );
  if (status === "error")
    return (
      <span className="flex items-center gap-[7px] text-[12.5px] font-medium text-status-error">
        <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-status-error/[0.16] text-[11px]">
          !
        </span>
        Erro
      </span>
    );
  if (status === "skipped")
    return (
      <button
        onClick={() => fallbackUrl && openExternal(fallbackUrl)}
        className="text-[12.5px] font-medium text-amber-light hover:underline"
      >
        Abrir site oficial
      </button>
    );
  if (status === "downloading" || status === "installing")
    return (
      <span
        className="h-[15px] w-[15px] flex-shrink-0 rounded-full border-2 border-amber-glow/25 border-t-amber-glow"
        style={{ animation: "forjaSpin 0.8s linear infinite" }}
      />
    );
  return <span className="font-mono text-[12px] text-forge-faint">na fila</span>;
}

function Legend() {
  const items: [string, string][] = [
    ["Concluído", "#3fa86a"],
    ["Baixando", "#5b9fd4"],
    ["Instalando", "#e8792b"],
    ["Na fila", "#9a8f80"],
    ["Erro", "#e25d4f"],
  ];
  return (
    <div className="flex items-center gap-4">
      {items.map(([label, color]) => (
        <span key={label} className="flex items-center gap-2 text-[11.5px] text-forge-muted">
          <span className="h-[9px] w-[9px] rounded-full" style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
