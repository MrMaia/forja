import { useForja } from "./store";
import Onboarding from "./screens/Onboarding";
import Catalog from "./screens/Catalog";
import Presets from "./screens/Presets";
import Install from "./screens/Install";
import Profiles from "./screens/Profiles";
import Settings from "./screens/Settings";

export default function App() {
  const { screen, loading } = useForja();

  if (loading) {
    return (
      <div className="grid h-full place-items-center font-mono text-sm text-forge-faint">
        carregando catálogo…
      </div>
    );
  }

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
  }
}
