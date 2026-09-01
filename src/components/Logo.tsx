import type { CSSProperties } from "react";

export function LogoMark({
  size = 32,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* steam */}
      <path d="M19 7c-2.6 2.6-2.6 5.4 0 8M26 5c-2.6 2.6-2.6 5.4 0 8" />
      {/* cup */}
      <path d="M12 20h19v5a9.5 9.5 0 0 1-19 0z" />
      {/* handle */}
      <path d="M31 21.5h2.5a4 4 0 0 1 0 8H31" />
      {/* saucer */}
      <path d="M12 34h19" />
    </svg>
  );
}

export function Logo({
  full = false,
  size = 28,
  className,
}: {
  full?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 text-ink ${className ?? ""}`}>
      <LogoMark size={size} />
      <span className="font-medium tracking-[-0.01em]" style={{ fontSize: size * 0.62 }}>
        {full ? "chayakudikkanpoyalo.in" : "chayakudikkanpoyalo"}
      </span>
    </span>
  );
}
