import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/** Full-height centered mobile column. */
export function Screen({
  children,
  className,
  center,
}: {
  children: ReactNode;
  className?: string;
  center?: boolean;
}) {
  return (
    <main
      className={cx(
        "mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col px-6 pb-10 pt-8",
        center && "justify-center",
        className,
      )}
    >
      {children}
    </main>
  );
}

export function Stack({
  children,
  gap = 4,
  className,
}: {
  children: ReactNode;
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10;
  className?: string;
}) {
  const gaps: Record<number, string> = {
    1: "gap-1",
    2: "gap-2",
    3: "gap-3",
    4: "gap-4",
    5: "gap-5",
    6: "gap-6",
    8: "gap-8",
    10: "gap-10",
  };
  return <div className={cx("flex flex-col", gaps[gap], className)}>{children}</div>;
}

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cx("text-[1.75rem] font-semibold leading-tight tracking-[-0.01em] text-ink", className)}>
      {children}
    </h1>
  );
}

export function QuietText({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-sm leading-relaxed text-ink-soft", className)}>{children}</p>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "quiet";
  full?: boolean;
};

export function Button({ variant = "primary", full, className, children, ...rest }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-2xl text-base font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-ink text-paper px-6 py-4 active:opacity-90",
    ghost: "border border-line text-ink px-6 py-4 active:opacity-70",
    quiet: "text-ink-soft text-sm underline underline-offset-4 decoration-line hover:text-ink px-2 py-2",
  }[variant];
  return (
    <button className={cx(base, styles, full && "w-full", className)} {...rest}>
      {children}
    </button>
  );
}

/** Sticky primary action pinned to the bottom of a Screen. */
export function BottomAction({ children }: { children: ReactNode }) {
  return <div className="mt-auto pt-8">{children}</div>;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string };

export function Field({ label, hint, className, ...rest }: FieldProps) {
  return (
    <label className="flex flex-col gap-2">
      {label && <span className="text-sm text-ink-soft">{label}</span>}
      <input
        className={cx(
          "w-full rounded-xl border border-line bg-paper-raised px-4 py-3 text-base text-ink placeholder:text-ink-soft/70 focus:border-ink focus:outline-none",
          className,
        )}
        {...rest}
      />
      {hint && <span className="text-xs text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label?: string;
}) {
  const round = "flex h-11 w-11 items-center justify-center rounded-full border border-line text-xl text-ink transition-opacity active:opacity-60 disabled:opacity-30";
  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm text-ink-soft">{label}</span>}
      <div className="flex items-center gap-5">
        <button type="button" className={round} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="fewer">
          −
        </button>
        <span className="min-w-[2ch] text-center text-3xl font-semibold tabular-nums text-ink">{value}</span>
        <button type="button" className={round} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="more">
          +
        </button>
      </div>
    </div>
  );
}

export function Divider() {
  return <div className="h-px w-full bg-line" />;
}
