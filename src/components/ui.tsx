"use client";

import type { ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Button: Primer button styles                                              */
/* -------------------------------------------------------------------------- */

export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  title,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "focus-ring btn-lift inline-flex items-center justify-center gap-1.5 rounded-md font-medium select-none disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const variants = {
    default:
      "btn-shadow bg-raised text-ink border border-line hover:bg-[#262c36] hover:border-faint active:bg-[#1c2128]",
    primary:
      "btn-glow bg-brand text-white border border-[rgba(240,246,252,0.1)] hover:bg-brand-soft active:bg-[#1f7a31]",
    ghost: "text-dim hover:text-ink hover:bg-raised border border-transparent",
    danger:
      "btn-shadow bg-raised text-rose border border-line hover:bg-rose hover:text-white hover:border-rose",
  }[variant];

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(base, sizes, variants, className)}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Box: Primer's bordered container                                          */
/* -------------------------------------------------------------------------- */

export function Box({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("overflow-hidden rounded-md border border-line bg-bg", className)}>
      {title ? (
        <div className="flex items-center gap-2 border-b border-line bg-panel px-3 py-2">
          <span className="text-xs font-semibold text-ink">{title}</span>
          {actions ? <span className="ml-auto flex items-center gap-1">{actions}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** GitHub issue-label style pill. */
export function Label({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "success" | "attention" | "done" | "danger";
}) {
  const tones = {
    default: "border-line text-dim",
    accent: "border-[rgba(56,139,253,0.4)] bg-[rgba(56,139,253,0.1)] text-accent",
    success: "border-[rgba(63,185,80,0.4)] bg-[rgba(63,185,80,0.1)] text-lime",
    attention: "border-[rgba(210,153,34,0.4)] bg-[rgba(210,153,34,0.1)] text-amber",
    done: "border-[rgba(171,125,248,0.4)] bg-[rgba(171,125,248,0.1)] text-done",
    danger: "border-[rgba(248,81,73,0.4)] bg-[rgba(248,81,73,0.1)] text-rose",
  }[tone];
  return (
    <span
      className={cx(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tones,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-dim">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-md border border-line bg-panel-2 px-3 py-1.5 text-sm text-ink transition-all duration-150 placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-[rgba(56,139,253,0.3)] focus:outline-none";

export function TextInput({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx(inputBase, mono && "font-mono text-[13px]")}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cx(inputBase, "resize-y py-2 leading-relaxed", mono && "font-mono text-[13px]")}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className="focus-ring group flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-panel"
    >
      <span className={cx("transition-colors", checked ? "text-ink" : "text-faint")}>{label}</span>
      <span
        aria-hidden
        className={cx(
          "relative h-[18px] w-8 shrink-0 rounded-full border transition-colors duration-200",
          checked ? "border-brand bg-brand" : "border-line bg-raised",
        )}
      >
        <span
          className={cx(
            "absolute top-[2px] h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-200 ease-out",
            checked ? "left-[15px]" : "left-[2px]",
          )}
        />
      </span>
    </button>
  );
}

/** GitHub flash/callout. */
export function Callout({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error" | "ok";
  children: ReactNode;
}) {
  const tones = {
    info: "border-line bg-panel text-dim",
    warn: "border-[rgba(210,153,34,0.4)] bg-[rgba(210,153,34,0.08)] text-[#e3b341]",
    error: "border-[rgba(248,81,73,0.4)] bg-[rgba(248,81,73,0.08)] text-[#ff7b72]",
    ok: "border-[rgba(63,185,80,0.4)] bg-[rgba(63,185,80,0.08)] text-[#56d364]",
  }[tone];
  return (
    <div
      className={cx(
        "slide-in rounded-md border px-3 py-2 text-xs leading-relaxed",
        tones,
      )}
    >
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-1 mb-2 border-b border-line pb-1.5 text-xs font-semibold text-ink">
      {children}
    </h3>
  );
}

/** Editable list of plain strings. */
export function StringList({
  items,
  onChange,
  placeholder,
  addLabel,
  mono,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="slide-in flex gap-1.5">
          <input
            value={item}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            className={cx(inputBase, mono && "font-mono text-[13px]")}
          />
          <Button
            variant="ghost"
            size="sm"
            title="Remove"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            ✕
          </Button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => onChange([...items, ""])}>
        + {addLabel}
      </Button>
    </div>
  );
}

/** lucide-react dropped brand icons, so the GitHub mark is inlined here. */
export function GithubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
