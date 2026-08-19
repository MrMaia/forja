import { useEffect, useState } from "react";
import { useForja } from "../store";
import { TitleBar, AppSidebar, Toggle, Icon, type IconName } from "../components/ui";
import {
  readTweaks,
  applyUserTweak,
  applyAdminTweaks,
  restartExplorer,
  type TweakState,
} from "../tauri";

// Tweaks grouped by theme (not by admin-requirement) — a group can mix
// instant (no admin) and elevation-gated rows; ADMIN_KEYS decides which path
// a given row's toggle takes. Labels/descriptions come from i18n (tw.<key>.*).
const GROUPS: { id: string; icon: IconName; keys: string[] }[] = [
  {
    id: "appearance",
    icon: "appearance",
    keys: ["dark-theme", "taskbar-left", "hide-widgets", "hide-chat", "explorer-thispc"],
  },
  { id: "explorer", icon: "explorer", keys: ["file-ext", "hidden-files"] },
  { id: "privacy", icon: "privacy", keys: ["bing-off", "telemetry-off", "consumer-off"] },
  { id: "power", icon: "power", keys: ["power-high", "hibernate-off"] },
];

const ADMIN_KEYS = new Set(["telemetry-off", "consumer-off", "power-high", "hibernate-off"]);

const NEEDS_EXPLORER = new Set([
  "file-ext",
  "hidden-files",
  "taskbar-left",
  "hide-widgets",
  "hide-chat",
  "explorer-thispc",
]);

export default function Tweaks() {
  const { go, t, isElevated } = useForja();
  const [state, setState] = useState<TweakState>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // user/admin tweak being applied
  const [admin, setAdmin] = useState<Record<string, boolean>>({}); // desired admin state
  const [applyingAdmin, setApplyingAdmin] = useState(false);
  const [explorerDirty, setExplorerDirty] = useState(false);

  const load = async () => {
    const s = await readTweaks();
    setState(s);
    setAdmin(Object.fromEntries([...ADMIN_KEYS].map((k) => [k, !!s[k]])));
    setLoading(false);
  };
  useEffect(() => {
    void load();
  }, []);

  // user tweak: apply immediately (no admin)
  const setUser = async (key: string, on: boolean) => {
    setBusy(key);
    try {
      await applyUserTweak(key, on);
      setState((p) => ({ ...p, [key]: on }));
      if (NEEDS_EXPLORER.has(key)) setExplorerDirty(true);
    } finally {
      setBusy(null);
    }
  };

  // when already elevated, an admin tweak applies on the spot (no UAC, no batch)
  const setAdminNow = async (key: string, on: boolean) => {
    setBusy(key);
    try {
      await applyAdminTweaks([{ key, on }]);
      setState((p) => ({ ...p, [key]: on }));
    } finally {
      setBusy(null);
    }
  };

  const adminChanged = [...ADMIN_KEYS].filter((k) => admin[k] !== !!state[k]);

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
    <div className="flex h-full bg-forge-bg">
      <AppSidebar />
      <div className="flex min-h-0 flex-1 flex-col">
      <TitleBar section={t("nav.tweaks")} onBack={() => go("catalog")} />
      <div className="flex-1 overflow-y-auto px-9 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="m-0 text-[24px] font-bold tracking-[-0.02em]">{t("nav.tweaks")}</h1>
            <p className="mt-2 max-w-[560px] text-[13.5px] leading-[1.6] text-forge-muted">
              {t("tweaks.intro")}
            </p>
          </div>
          {!isElevated && adminChanged.length > 0 && (
            <button
              onClick={applyAdmin}
              disabled={applyingAdmin}
              className="flex-shrink-0 rounded-[10px] border border-amber-glow/40 bg-amber-glow/[0.12] px-4 py-2.5 text-[12.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20 disabled:opacity-50"
            >
              {applyingAdmin ? t("tweaks.applying") : t("tweaks.applyN", { n: adminChanged.length })}
            </button>
          )}
        </div>

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
          <div className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {GROUPS.map((group) => (
              <div
                key={group.id}
                className="overflow-hidden rounded-[13px] border border-white/[0.07] bg-[#1a1613]"
              >
                <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-3.5">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px] bg-amber-glow/[0.12] text-amber-soft">
                    <Icon name={group.icon} size={15} />
                  </span>
                  <span className="text-[13.5px] font-semibold">{t(`tweaks.group.${group.id}`)}</span>
                </div>
                {group.keys.map((key) => {
                  const needsAdmin = ADMIN_KEYS.has(key);
                  const lockedForNow = needsAdmin && !isElevated;
                  const on = lockedForNow ? !!admin[key] : !!state[key];
                  const pending = lockedForNow && admin[key] !== !!state[key];
                  const onChange = lockedForNow
                    ? () => setAdmin((p) => ({ ...p, [key]: !p[key] }))
                    : needsAdmin
                      ? () => setAdminNow(key, !state[key])
                      : () => setUser(key, !state[key]);
                  return (
                    <TweakRow
                      key={key}
                      label={t(`tw.${key}.label`)}
                      desc={t(`tw.${key}.desc`)}
                      needsAdmin={needsAdmin}
                      on={on}
                      pending={pending}
                      pendingLabel={t("tweaks.pending")}
                      adminLabel={t("tweaks.needsAdminBadge")}
                      busy={busy === key}
                      onChange={onChange}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <p className="mt-5 text-[11.5px] text-forge-faint">
          {isElevated ? t("tweaks.adminNoteElevated") : t("tweaks.adminNote")}
        </p>
      </div>
      </div>
    </div>
  );
}

function TweakRow({
  label,
  desc,
  on,
  onChange,
  needsAdmin,
  busy = false,
  pending = false,
  pendingLabel,
  adminLabel,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: () => void;
  needsAdmin: boolean;
  busy?: boolean;
  pending?: boolean;
  pendingLabel: string;
  adminLabel: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-white/[0.05] px-5 py-[13px] last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
          {label}
          {needsAdmin && (
            <span className="rounded-full border border-white/10 px-2 py-px text-[9.5px] font-semibold uppercase tracking-[0.05em] text-forge-faint">
              {adminLabel}
            </span>
          )}
          {pending && (
            <span className="rounded-full bg-amber-glow/20 px-2 py-px text-[10px] font-semibold text-amber-soft">
              {pendingLabel}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[12px] leading-[1.45] text-forge-muted">{desc}</div>
      </div>
      <Toggle on={on} onChange={onChange} busy={busy} label={label} />
    </div>
  );
}
