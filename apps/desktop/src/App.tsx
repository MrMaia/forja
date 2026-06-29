import { useForja } from "./store";
import Onboarding from "./screens/Onboarding";
import Catalog from "./screens/Catalog";
import Presets from "./screens/Presets";
import Install from "./screens/Install";
import Profiles from "./screens/Profiles";
import Settings from "./screens/Settings";
import Drivers from "./screens/Drivers";
import Tweaks from "./screens/Tweaks";
import { Diamond } from "./components/ui";

function Screen() {
  const { screen } = useForja();
  switch (screen) {
    case "onboarding":
      return <Onboarding />;
    case "catalog":
      return <Catalog />;
    case "presets":
      return <Presets />;
    case "install":
      return <Install />;
    case "profiles":
      return <Profiles />;
    case "settings":
      return <Settings />;
    case "drivers":
      return <Drivers />;
    case "tweaks":
      return <Tweaks />;
  }
}

// Floating "update available" card, bottom-right, on any screen except Settings
// (which already has its own update row). Dismissible for the session.
function UpdateToast() {
  const {
    forjaUpdate,
    updateDismissed,
    dismissUpdate,
    runForjaUpdate,
    installingUpdate,
    screen,
    t,
  } = useForja();
  if (!forjaUpdate?.hasUpdate || updateDismissed || screen === "settings") return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[300px] rounded-[14px] border border-amber-glow/40 bg-[#1f1915] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-start gap-3">
        <Diamond size={20} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold">{t("update.available")}</div>
          <div className="mt-0.5 text-[12.5px] text-forge-muted">
            {t("settings.newVersion", { v: forjaUpdate.latest ?? "" })}
          </div>
        </div>
        <button
          onClick={dismissUpdate}
          aria-label={t("update.dismiss")}
          title={t("update.dismiss")}
          className="-mr-1 -mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[6px] text-forge-faint transition-colors hover:bg-white/10 hover:text-forge-text"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          onClick={dismissUpdate}
          className="rounded-[9px] px-3 py-1.5 text-[12.5px] font-medium text-forge-muted transition-colors hover:text-forge-text"
        >
          {t("update.dismiss")}
        </button>
        <button
          onClick={runForjaUpdate}
          disabled={installingUpdate}
          className="rounded-[9px] border border-amber-glow/40 bg-amber-glow/[0.12] px-3.5 py-1.5 text-[12.5px] font-semibold text-amber-soft transition-colors hover:bg-amber-glow/20 disabled:opacity-50"
        >
          {installingUpdate ? t("settings.downloading") : t("settings.download")}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { loading } = useForja();

  if (loading) {
    return (
      <div className="grid h-full place-items-center font-mono text-sm text-forge-faint">
        carregando catálogo…
      </div>
    );
  }

  return (
    <>
      <Screen />
      <UpdateToast />
    </>
  );
}
