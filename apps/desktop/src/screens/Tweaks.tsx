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

// keys only — labels/descriptions come from i18n (tw.<key>.label / .desc)
const USER_TWEAKS = [
  "dark-theme",
  "file-ext",
  "hidden-files",
  "taskbar-left",
  "hide-widgets",
  "hide-chat",
  "explorer-thispc",
  "bing-off",
];

const ADMIN_TWEAKS = ["telemetry-off", "consumer-off", "power-high", "hibernate-off"];

const NEEDS_EXPLORER = new Set([
  "file-ext",
  "hidden-files",
  "taskbar-left",
  "hide-widgets",
  "hide-chat",
  "explorer-thispc",
]);

export default function Tweaks() {
  const { go, t } = useForja();
  const [state, setState] = useState<TweakState>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // user tweak being applied
  const [admin, setAdmin] = useState<Record<string, boolean>>({}); // desired admin state
  const [applyingAdmin, setApplyingAdmin] = useState(false);
  const [explorerDirty, setExplorerDirty] = useState(false);

  const load = async () => {
    const s = await readTweaks();
    setState(s);
    setAdmin(Object.fromEntries(ADMIN_TWEAKS.map((k) => [k, !!s[k]])));
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  // user tweak: apply immediately (no admin)
  const setUser = async (key: string, on: boolean) => {
    if (!!state[key] === on) return; // already in that state
    setBusy(key);
    try {
      await applyUserTweak(key, on);
      setState((p) => ({ ...p, [key]: on }));
      if (NEEDS_EXPLORER.has(key)) setExplorerDirty(true);
    } finally {
      setBusy(null);
    }
  };

  const adminChanged = ADMIN_TWEAKS.filter((k) => admin[k] !== !!state[k]);

  const applyAdmin = async () => {
    if (adminChanged.length === 0) return;
    setApplyingAdmin(true);
    try {
      await applyAdminTweaks(adminChanged.map((k) => ({ key: k, on: admin[k] })));
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
      <TitleBar section={t("nav.tweaks")} onBack={() => go("catalog")} />
      <div className="flex-1 overflow-y-auto px-9 py-8">
        <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">{t("nav.tweaks")}</h1>
        <p className="mt-2 max-w-[640px] text-[13.5px] leading-[1.6] text-forge-muted">
          {t("tweaks.intro")}
        </p>

        {explorerDirty && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-[12px] border border-amber-glow/40 bg-amber-glow/[0.08] px-4 py-3">
            <span className="text-[12.5px] text-amber-light">{t("tweaks.explorerNote")}</span>
            <button
              onClick={doRestartExplorer}
              className="flex-shrink-0 rounded-[8px] border border-amber-glow/40 bg-amber-glow/[0.12] px-3 py-1.5 text-[12px] font-semibold text-amber-soft hover:bg-amber-glow/20"
            >
              {t("tweaks.restartExplorer")}
            </button>
          </div>
        )}

        {loading ? (
          <div className="mt-8 font-mono text-sm text-forge-faint">{t("tweaks.reading")}</div>
        ) : (
          <>
            <SectionTitle>{t("tweaks.noAdmin")}</SectionTitle>
            <div className="overflow-hidden rounded-[13px] border border-white/[0.07] bg-[#1a1613]">
              {USER_TWEAKS.map((key) => (
                <ButtonRow
                  key={key}
                  label={t(`tw.${key}.label`)}
                  desc={t(`tw.${key}.desc`)}
                  on={!!state[key]}
                  busy={busy === key}
                  enableLabel={t("tweaks.enable")}
                  disableLabel={t("tweaks.disable")}
                  applyingLabel={t("tweaks.applying")}
                  onEnable={() => setUser(key, true)}
                  onDisable={() => setUser(key, false)}
                />
              ))}
            </div>

            <div className="mt-7 flex items-center justify-between">
              <SectionTitle>{t("tweaks.needAdmin")}</SectionTitle>
              <button
                onClick={applyAdmin}
                disabled={adminChanged.length === 0 || applyingAdmin}
                className="rounded-[9px] border border-amber-glow/40 bg-amber-glow/[0.12] px-4 py-2 text-[12.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20 disabled:opacity-40"
              >
                {applyingAdmin
                  ? t("tweaks.applying")
                  : adminChanged.length > 0
                    ? t("tweaks.applyN", { n: adminChanged.length })
                    : t("tweaks.apply")}
              </button>
            </div>
            <div className="overflow-hidden rounded-[13px] border border-white/[0.07] bg-[#1a1613]">
              {ADMIN_TWEAKS.map((key) => (
                <ButtonRow
                  key={key}
                  label={t(`tw.${key}.label`)}
                  desc={t(`tw.${key}.desc`)}
                  on={!!admin[key]}
                  pending={admin[key] !== !!state[key]}
                  pendingLabel={t("tweaks.pending")}
                  enableLabel={t("tweaks.enable")}
                  disableLabel={t("tweaks.disable")}
                  applyingLabel={t("tweaks.applying")}
                  onEnable={() => setAdmin((p) => ({ ...p, [key]: true }))}
                  onDisable={() => setAdmin((p) => ({ ...p, [key]: false }))}
                />
              ))}
            </div>
            <p className="mt-2 text-[11.5px] text-forge-faint">{t("tweaks.adminNote")}</p>
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

function ButtonRow({
  label,
  desc,
  on,
  onEnable,
  onDisable,
  enableLabel,
  disableLabel,
  applyingLabel,
  busy = false,
  pending = false,
  pendingLabel,
}: {
  label: string;
  desc: string;
  on: boolean;
  onEnable: () => void;
  onDisable: () => void;
  enableLabel: string;
  disableLabel: string;
  applyingLabel: string;
  busy?: boolean;
  pending?: boolean;
  pendingLabel?: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-white/[0.05] px-5 py-[14px] last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[14px] font-medium">
          {label}
          {pending && pendingLabel && (
            <span className="rounded-full bg-amber-glow/20 px-2 py-px text-[10px] font-semibold text-amber-soft">
              {pendingLabel}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[12.5px] leading-[1.45] text-forge-muted">{desc}</div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={onEnable}
          disabled={busy}
          className={
            "rounded-[8px] border px-3.5 py-[7px] text-[11.5px] font-bold tracking-[0.03em] transition-colors disabled:opacity-50 " +
            (on
              ? "border-status-done/45 bg-status-done/[0.14] text-status-done"
              : "border-white/12 text-forge-muted hover:border-status-done/40 hover:text-status-done")
          }
        >
          {busy ? applyingLabel : enableLabel}
        </button>
        <button
          onClick={onDisable}
          disabled={busy}
          className={
            "rounded-[8px] border px-3.5 py-[7px] text-[11.5px] font-bold tracking-[0.03em] transition-colors disabled:opacity-50 " +
            (!on
              ? "border-status-error/45 bg-status-error/[0.12] text-status-error"
              : "border-white/12 text-forge-muted hover:border-status-error/40 hover:text-status-error")
          }
        >
          {busy ? applyingLabel : disableLabel}
        </button>
      </div>
    </div>
  );
}
