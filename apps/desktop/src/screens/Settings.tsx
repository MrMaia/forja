import { useForja } from "../store";
import { TitleBar } from "../components/ui";
import { LANGS, type Lang } from "../i18n";
import { relaunchAsAdmin, APP_VERSION } from "../tauri";

export default function Settings() {
  const {
    settings,
    updateSetting,
    go,
    t,
    updatesCount,
    upgradeAll,
    refreshInstalled,
    checking: scanningApps,
    isElevated: admin,
    forjaUpdate: update,
    checkingForja: checking,
    checkForjaNow,
    installingUpdate: updating,
    runForjaUpdate,
  } = useForja();

  const check = () => checkForjaNow();
  const runUpdate = () => runForjaUpdate();

  const updateStatus = () => {
    if (checking) return t("settings.checking");
    if (!update) return t("settings.checkHint");
    if (update.hasUpdate) return t("settings.newVersion", { v: update.latest ?? "" });
    if (update.latest) return t("settings.upToDate");
    return t("settings.checkFail");
  };

  return (
    <div className="flex h-full flex-col bg-forge-bg">
      <TitleBar section={t("settings.title")} onBack={() => go("catalog")} />
      <div className="flex-1 overflow-y-auto px-9 py-8">
        <h1 className="m-0 mb-7 text-[24px] font-bold tracking-[-0.02em]">{t("settings.title")}</h1>

        <Section title={t("settings.language")}>
          <Row label={t("settings.languageRow")} desc={t("settings.languageDesc")}>
            <div className="flex gap-1.5">
              {LANGS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => updateSetting("lang", l.value as Lang)}
                  className={
                    "rounded-[8px] border px-3 py-1.5 text-[12.5px] font-medium transition-colors " +
                    (settings.lang === l.value
                      ? "border-amber-glow/45 bg-amber-glow/[0.12] text-amber-soft"
                      : "border-white/12 text-forge-muted hover:text-forge-text")
                  }
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        <Section title={t("settings.updates")}>
          <Toggle
            label={t("settings.autoCheck")}
            desc={t("settings.autoCheckDesc")}
            checked={settings.autoUpdateCheck}
            onChange={(v) => updateSetting("autoUpdateCheck", v)}
          />
          <Row label={`Forja v${APP_VERSION}`} desc={updateStatus()}>
            {update?.hasUpdate ? (
              <button
                onClick={runUpdate}
                disabled={updating}
                className="rounded-[9px] border border-amber-glow/40 bg-amber-glow/[0.12] px-4 py-2 text-[12.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20 disabled:opacity-50"
              >
                {updating ? t("settings.downloading") : t("settings.download")}
              </button>
            ) : (
              <button
                onClick={check}
                disabled={checking}
                className="rounded-[9px] border border-white/15 px-4 py-2 text-[12.5px] font-medium text-forge-muted transition-colors hover:border-white/25 hover:text-forge-text disabled:opacity-50"
              >
                {checking ? t("settings.checking") : t("settings.checkNow")}
              </button>
            )}
          </Row>
        </Section>

        <Section title={t("settings.programs")}>
          <Row
            label={
              updatesCount > 0
                ? `${updatesCount} ${t("settings.withUpdate")}`
                : t("settings.allUpdated")
            }
            desc={t("settings.detectDesc")}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => refreshInstalled()}
                disabled={scanningApps}
                className="rounded-[9px] border border-white/15 px-3.5 py-2 text-[12.5px] font-medium text-forge-muted transition-colors hover:border-white/25 hover:text-forge-text disabled:opacity-50"
              >
                {scanningApps ? t("settings.checking") : t("settings.verify")}
              </button>
              {updatesCount > 0 && (
                <button
                  onClick={() => {
                    upgradeAll();
                    go("install");
                  }}
                  className="rounded-[9px] border border-amber-glow/40 bg-amber-glow/[0.12] px-3.5 py-2 text-[12.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20"
                >
                  {t("settings.updateAll")}
                </button>
              )}
            </div>
          </Row>
        </Section>

        <Section title={t("settings.catalog")}>
          <Toggle
            label={t("settings.hideInstalled")}
            desc={t("settings.hideInstalledDesc")}
            checked={settings.hideInstalled}
            onChange={(v) => updateSetting("hideInstalled", v)}
          />
        </Section>

        <Section title={t("settings.access")}>
          <Row label={t("settings.adminRow")} desc={t("settings.adminDesc")}>
            {admin && (
              <span className="flex items-center gap-2 text-[12.5px] font-medium text-status-done">
                <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-status-done/[0.16] text-[11px]">
                  ✓
                </span>
                {t("settings.adminOn")}
              </span>
            )}
          </Row>
          <Toggle
            label={t("settings.alwaysAdmin")}
            desc={t("settings.alwaysAdminDesc")}
            checked={settings.alwaysAdmin}
            onChange={(v) => {
              updateSetting("alwaysAdmin", v);
              if (v && !admin) void relaunchAsAdmin();
            }}
          />
        </Section>

        <Section title={t("settings.about")}>
          <Row label="Forja — Do zero ao pronto." desc={t("settings.aboutDesc")} />
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
