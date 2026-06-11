import type {
  ComponentPropsWithRef,
  ReactNode,
} from "react";

/**
 * Clay 组件库 · 首批 10 个（docs/03-design-system.md §5）
 * 结构尽量薄：视觉全部在 clay.css，组件只管语义与 a11y。
 * Dialog / Tooltip / Toast 涉及浮层定位，M2 按需补齐。
 */

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(" ");
}

/* ── ClayButton ── */
export interface ClayButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: "primary" | "soft" | "ghost";
}

export function ClayButton({ variant = "soft", className, type = "button", ...rest }: ClayButtonProps) {
  return <button type={type} data-variant={variant} className={cx("clay-btn", className)} {...rest} />;
}

/* ── ClayCard ── */
export interface ClayCardProps extends ComponentPropsWithRef<"div"> {
  hoverable?: boolean;
}

export function ClayCard({ hoverable = false, className, ...rest }: ClayCardProps) {
  return <div data-hoverable={hoverable} className={cx("clay-card", className)} {...rest} />;
}

/* ── ClayTag：色相按文字哈希取，像捏的小泥条 ── */
const TAG_HUES = ["accent", "sun", "blush"] as const;

function hueOf(text: string): (typeof TAG_HUES)[number] {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return TAG_HUES[h % TAG_HUES.length]!;
}

export interface ClayTagProps extends ComponentPropsWithRef<"span"> {
  children: ReactNode;
}

export function ClayTag({ className, children, ...rest }: ClayTagProps) {
  return (
    <span data-hue={hueOf(String(children))} className={cx("clay-tag", className)} {...rest}>
      {children}
    </span>
  );
}

/* ── ClayInput / ClayTextarea ── */
export function ClayInput({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return <input className={cx("clay-input", className)} {...rest} />;
}

export function ClayTextarea({ className, ...rest }: ComponentPropsWithRef<"textarea">) {
  return <textarea className={cx("clay-textarea", className)} {...rest} />;
}

/* ── ClayToggle ── */
export interface ClayToggleProps extends Omit<ComponentPropsWithRef<"input">, "type"> {
  label: string;
}

export function ClayToggle({ label, className, ...rest }: ClayToggleProps) {
  return (
    <label className={cx("clay-toggle", className)}>
      <input type="checkbox" role="switch" aria-label={label} {...rest} />
      <span className="clay-toggle-track">
        <span className="clay-toggle-knob" />
      </span>
    </label>
  );
}

/* ── ClayAvatar ── */
export interface ClayAvatarProps extends ComponentPropsWithRef<"img"> {
  size?: number;
}

export function ClayAvatar({ size = 64, className, alt = "", ...rest }: ClayAvatarProps) {
  return <img width={size} height={size} alt={alt} className={cx("clay-avatar", className)} {...rest} />;
}

/* ── ClayDivider ── */
export function ClayDivider({ className, ...rest }: ComponentPropsWithRef<"svg">) {
  return (
    <svg
      role="separator"
      aria-hidden="true"
      viewBox="0 0 200 10"
      preserveAspectRatio="none"
      className={cx("clay-divider", className)}
      {...rest}
    >
      <path
        d="M0 5 Q 12 0, 25 5 T 50 5 T 75 5 T 100 5 T 125 5 T 150 5 T 175 5 T 200 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ── ClayProgress ── */
export interface ClayProgressProps extends ComponentPropsWithRef<"div"> {
  value: number; // 0–100
  label: string;
}

export function ClayProgress({ value, label, className, ...rest }: ClayProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cx("clay-progress", className)}
      {...rest}
    >
      <div className="clay-progress-bar" style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* ── ClaySkeleton ── */
export interface ClaySkeletonProps extends ComponentPropsWithRef<"div"> {
  shape?: "rect" | "blob";
}

export function ClaySkeleton({ shape = "rect", className, ...rest }: ClaySkeletonProps) {
  return <div aria-hidden="true" data-shape={shape} className={cx("clay-skeleton", className)} {...rest} />;
}
