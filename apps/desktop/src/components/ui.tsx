import { useState } from "react";
import type { Program, ProgramIcon } from "@forja/catalog";
import { isTauri } from "../tauri";
import { useForja } from "../store";
import logoUrl from "../assets/logo.png";

async function windowAction(action: "minimize" | "toggleMaximize" | "close") {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow()[action]();
}

// The Forja logo mark, used in the brand spots across the app (TitleBar,
// onboarding, Perfis, Presets).
export function Diamond({ size = 13, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <img
      src={logoUrl}
      alt=""
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        filter: glow ? `drop-shadow(0 0 ${size * 0.35}px rgba(245,147,63,0.55))` : undefined,
        flexShrink: 0,
      }}
    />
  );
}

// 44px window chrome: brand + optional section label + faux window controls.
// `onBack`, when set, shows a back arrow at the top-left (where users expect it).
export function TitleBar({ section, onBack }: { section?: string; onBack?: () => void }) {
  const { t } = useForja();
  return (
    <div
      data-tauri-drag-region
      className="flex h-11 flex-shrink-0 items-center justify-between border-b border-white/5 bg-forge-chrome px-3.5"
    >
      <div className="flex items-center gap-2.5">
        {onBack && (
          <button
            onClick={onBack}
            aria-label={t("win.back")}
            title={t("win.back")}
            className="-ml-1 flex h-7 w-7 items-center justify-center rounded-[7px] text-forge-muted transition-colors hover:bg-white/10 hover:text-forge-text"
          >
            <Chevron dir="left" size={16} />
          </button>
        )}
        <div className="pointer-events-none flex items-center gap-2.5">
          <Diamond />
          <span className="text-[13px] font-semibold tracking-wide">Forja</span>
          {section && <span className="ml-1.5 text-xs text-forge-dim">{section}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <WindowButton label={t("win.min")} onClick={() => windowAction("minimize")}>
          <span className="h-[1.5px] w-[11px] bg-current" />
        </WindowButton>
        <WindowButton label={t("win.max")} onClick={() => windowAction("toggleMaximize")}>
          <span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-current" />
        </WindowButton>
        <WindowButton label={t("win.close")} danger onClick={() => windowAction("close")}>
          <span className="text-[13px] leading-none">✕</span>
        </WindowButton>
      </div>
    </div>
  );
}

function WindowButton({
  children,
  onClick,
  label,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={
        "flex h-7 w-9 items-center justify-center rounded-[6px] text-forge-dim transition-colors " +
        (danger ? "hover:bg-status-error hover:text-white" : "hover:bg-white/10 hover:text-forge-text")
      }
    >
      {children}
    </button>
  );
}

// Primary navigation, persistent across every screen (not just Catálogo).
// Collapses to icons-only; state is a Setting so it's remembered across opens.
export function AppSidebar() {
  const { screen, go, t, installing, settings, updateSetting } = useForja();
  const collapsed = settings.sidebarCollapsed;
  return (
    <aside
      className={
        "flex flex-shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-forge-inset py-[14px] transition-[width] " +
        (collapsed ? "w-[60px] items-center px-2" : "w-[200px] px-3.5")
      }
    >
      <button
        onClick={() => updateSetting("sidebarCollapsed", !collapsed)}
        aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
        title={t(collapsed ? "nav.expand" : "nav.collapse")}
        className={
          "mb-3 flex h-7 flex-shrink-0 items-center justify-center rounded-[7px] text-forge-dim transition-colors hover:bg-white/[0.06] hover:text-forge-text " +
          (collapsed ? "w-7" : "w-7 self-end")
        }
      >
        <Icon name="sidebarToggle" size={15} />
      </button>

      {!collapsed && (
        <div className="mb-1.5 px-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-forge-faint">
          {t("nav.title")}
        </div>
      )}
      <div className="flex w-full flex-col gap-0.5">
        <SidebarLink icon="home" label={t("nav.home")} collapsed={collapsed} active={screen === "onboarding"} onClick={() => go("onboarding")} />
        <SidebarLink icon="catalog" label={t("nav.catalog")} collapsed={collapsed} active={screen === "catalog"} onClick={() => go("catalog")} />
        <SidebarLink
          icon="install"
          label={t("nav.installs")}
          collapsed={collapsed}
          active={screen === "install"}
          onClick={() => go("install")}
          badge={installing ? "•" : undefined}
        />
        <SidebarLink icon="presets" label={t("nav.presets")} collapsed={collapsed} active={screen === "presets"} onClick={() => go("presets")} />
        <SidebarLink icon="export" label={t("nav.export")} collapsed={collapsed} active={screen === "profiles"} onClick={() => go("profiles")} />
        <div className="my-2 border-t border-white/[0.06]" />
        <SidebarLink icon="drivers" label={t("nav.drivers")} collapsed={collapsed} active={screen === "drivers"} onClick={() => go("drivers")} />
        <SidebarLink icon="tweaks" label={t("nav.tweaks")} collapsed={collapsed} active={screen === "tweaks"} onClick={() => go("tweaks")} />
        <SidebarLink icon="settings" label={t("nav.settings")} collapsed={collapsed} active={screen === "settings"} onClick={() => go("settings")} />
      </div>
    </aside>
  );
}

function SidebarLink({
  icon,
  label,
  onClick,
  badge,
  active = false,
  collapsed = false,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
  badge?: string;
  active?: boolean;
  collapsed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={
        "group relative flex items-center rounded-[9px] text-[12.5px] transition-colors " +
        (collapsed ? "h-9 w-9 justify-center" : "gap-[10px] px-[11px] py-2") +
        " " +
        (active
          ? "bg-amber-glow/10 font-semibold text-amber-light"
          : "text-[#8e857a] hover:bg-white/[0.04] hover:text-[#bcb2a5]")
      }
    >
      <Icon name={icon} size={16} />
      {badge && (
        <span
          className={
            "absolute h-[6px] w-[6px] animate-pulse rounded-full bg-amber-glow " +
            (collapsed ? "right-1 top-1" : "right-[9px] top-1/2 -translate-y-1/2")
          }
        />
      )}
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          <span className="text-forge-dim transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-amber-light">
            <Chevron dir="right" size={13} />
          </span>
        </>
      )}
    </button>
  );
}

// Thin directional chevron. Inherits color via currentColor.
export function Chevron({
  dir = "right",
  size = 14,
}: {
  dir?: "left" | "right";
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d={dir === "right" ? "M6 3.5L10.5 8 6 12.5" : "M10 3.5L5.5 8 10 12.5"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type IconName =
  | "home"
  | "catalog"
  | "install"
  | "presets"
  | "export"
  | "drivers"
  | "tweaks"
  | "settings"
  | "sidebarToggle"
  | "appearance"
  | "explorer"
  | "privacy"
  | "power";

// Small line-icon set for chrome (nav rows, tweak groups). 16x16, thin
// stroke, currentColor — matches Chevron's style so they read as one family.
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none" as const,
    "aria-hidden": true as const,
  };
  const stroke = { stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 8L8 3.5L13 8" {...stroke} />
          <path d="M4.5 6.8V13H11.5V6.8" {...stroke} />
        </svg>
      );
    case "catalog":
      return (
        <svg {...common}>
          <rect x="2.7" y="2.7" width="4.2" height="4.2" rx="1" {...stroke} />
          <rect x="9.1" y="2.7" width="4.2" height="4.2" rx="1" {...stroke} />
          <rect x="2.7" y="9.1" width="4.2" height="4.2" rx="1" {...stroke} />
          <rect x="9.1" y="9.1" width="4.2" height="4.2" rx="1" {...stroke} />
        </svg>
      );
    case "install":
      return (
        <svg {...common}>
          <path d="M8 2.5V9.5" {...stroke} />
          <path d="M5 7L8 10L11 7" {...stroke} />
          <path d="M3 12.7H13" {...stroke} />
        </svg>
      );
    case "presets":
      return (
        <svg {...common}>
          <path d="M8 2.7L13 5.8L8 8.9L3 5.8Z" {...stroke} />
          <path d="M3 9.3L8 12.4L13 9.3" {...stroke} />
        </svg>
      );
    case "export":
      return (
        <svg {...common}>
          <path d="M5.2 3V11" {...stroke} />
          <path d="M3 9L5.2 11.2L7.4 9" {...stroke} />
          <path d="M10.8 13V5" {...stroke} />
          <path d="M8.6 7L10.8 4.8L13 7" {...stroke} />
        </svg>
      );
    case "drivers":
      return (
        <svg {...common}>
          <path d="M2.7 6.4C5.7 3.7 10.3 3.7 13.3 6.4" {...stroke} />
          <path d="M4.9 9C6.6 7.5 9.4 7.5 11.1 9" {...stroke} />
          <circle cx="8" cy="11.8" r="1.05" fill="currentColor" stroke="none" />
        </svg>
      );
    case "tweaks":
      return (
        <svg {...common}>
          <path d="M2.8 5H13.2" {...stroke} />
          <path d="M2.8 8H13.2" {...stroke} />
          <path d="M2.8 11H13.2" {...stroke} />
          <circle cx="6" cy="5" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="10.2" cy="8" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="7.4" cy="11" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.15" {...stroke} />
          <path
            d="M8 2.3V4.1M8 11.9V13.7M2.3 8H4.1M11.9 8H13.7M4.05 4.05L5.35 5.35M10.65 10.65L11.95 11.95M4.05 11.95L5.35 10.65M10.65 5.35L11.95 4.05"
            {...stroke}
          />
        </svg>
      );
    case "sidebarToggle":
      return (
        <svg {...common}>
          <rect x="2.5" y="3.2" width="11" height="9.6" rx="1.6" {...stroke} />
          <path d="M6.4 3.2V12.8" {...stroke} />
        </svg>
      );
    case "appearance":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.3" {...stroke} />
          <path d="M8 2.7A5.3 5.3 0 0 1 8 13.3Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "explorer":
      return (
        <svg {...common}>
          <path
            d="M2.5 5.3C2.5 4.6 3.05 4.1 3.7 4.1H6.2L7.2 5.3H12.3C13 5.3 13.5 5.8 13.5 6.5V11.1C13.5 11.8 13 12.3 12.3 12.3H3.7C3.05 12.3 2.5 11.8 2.5 11.1V5.3Z"
            {...stroke}
          />
        </svg>
      );
    case "privacy":
      return (
        <svg {...common}>
          <path d="M8 2.5L13 4.3V7.9C13 10.7 10.9 12.6 8 13.5C5.1 12.6 3 10.7 3 7.9V4.3L8 2.5Z" {...stroke} />
        </svg>
      );
    case "power":
      return (
        <svg {...common}>
          <path d="M8.7 2.5L4.2 9H7.6L6.9 13.5L12 7H8.4Z" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

// Amber toggle switch — used wherever a setting is a plain on/off (Tweaks).
export function Toggle({
  on,
  onChange,
  disabled = false,
  busy = false,
  label,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onChange}
      className={
        "relative h-[22px] w-[38px] flex-shrink-0 rounded-full transition-colors disabled:opacity-50 " +
        (on ? "bg-gradient-to-b from-amber-from to-amber-to" : "bg-white/[0.12]")
      }
    >
      <span
        className="absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)] transition-transform"
        style={{ transform: on ? "translateX(16px)" : "translateX(0)" }}
      />
      {busy && (
        <span className="absolute inset-0 grid place-items-center">
          <span
            className="h-3 w-3 rounded-full border-2 border-[#1a1109]/30 border-t-[#1a1109]"
            style={{ animation: "forjaSpin 0.8s linear infinite" }}
          />
        </span>
      )}
    </button>
  );
}

// 2-letter monogram tile from a program's icon spec.
export function Monogram({
  icon,
  size = 42,
  radius = 10,
  font,
}: {
  icon: ProgramIcon;
  size?: number;
  radius?: number;
  font?: number;
}) {
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center font-mono font-semibold"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: icon.bg,
        color: icon.fg,
        fontSize: font ?? size * 0.38,
      }}
    >
      {icon.label}
    </div>
  );
}

// Real app logo on a neutral tile, with a graceful fallback to the monogram
// when the program has no iconUrl or the image fails to load (offline, 404).
export function AppIcon({
  program,
  size = 42,
  radius = 10,
  font,
}: {
  program: Program;
  size?: number;
  radius?: number;
  font?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!program.iconUrl || failed) {
    return <Monogram icon={program.icon} size={size} radius={radius} font={font} />;
  }
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center bg-white/[0.05]"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <img
        src={program.iconUrl}
        alt=""
        width={Math.round(size * 0.62)}
        height={Math.round(size * 0.62)}
        onError={() => setFailed(true)}
        style={{ objectFit: "contain" }}
      />
    </div>
  );
}

// Primary amber action button.
export function AmberButton({
  children,
  onClick,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={
        "rounded-[11px] bg-gradient-to-b from-amber-from to-amber-to font-semibold text-[#1a1109] " +
        "shadow-[0_8px_24px_rgba(245,147,63,0.3)] transition-transform hover:-translate-y-px " +
        className
      }
    >
      {children}
    </button>
  );
}
