import { useState } from "react";
import type { Program, ProgramIcon } from "@forja/catalog";
import { isTauri } from "../tauri";
import { useForja } from "../store";

async function windowAction(action: "minimize" | "toggleMaximize" | "close") {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow()[action]();
}

// The rotated amber diamond used in the logo / brand marks.
export function Diamond({ size = 13, glow = true }: { size?: number; glow?: boolean }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.23,
        transform: "rotate(45deg)",
        background: "linear-gradient(135deg,#ffbd7a,#e8792b)",
        boxShadow: glow ? `0 0 ${size * 0.7}px rgba(245,147,63,0.55)` : undefined,
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

// Secondary "back" pill: left chevron that nudges on hover.
export function BackLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group inline-flex items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-[13px] font-medium text-forge-muted transition-colors hover:border-white/[0.16] hover:text-forge-text"
    >
      <span className="text-forge-faint transition-transform duration-150 group-hover:-translate-x-0.5 group-hover:text-amber-light">
        <Chevron dir="left" />
      </span>
      {children}
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
        loading="lazy"
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
