import type { CSSProperties } from "react";

export type DoodleName =
  | "flower"
  | "cup"
  | "kettle"
  | "steam"
  | "moon"
  | "chair"
  | "table"
  | "pin"
  | "sparkle";

const paths: Record<DoodleName, React.ReactNode> = {
  // filled, like the reference
  flower: (
    <path
      d="M52 20c7-9 22-8 25 3 8-3 18 5 15 15 10 2 12 15 3 21 5 8-3 19-13 17 0 10-13 15-20 8-6 8-20 5-21-5-10 3-19-7-15-17-9-5-8-19 2-22-3-10 7-19 17-15 3-8 12-9 17-4Zm-4 27a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  cup: (
    <>
      <path d="M24 40h44v20c0 13-10 23-22 23S24 73 24 60V40Z" />
      <path d="M68 45h7c7 0 12 5 12 12s-5 12-12 12h-4" />
      <path d="M22 90h48" />
    </>
  ),
  kettle: (
    <>
      <path d="M30 48c0-13 10-22 24-22s24 9 24 22c5 2 8 7 8 13 0 12-14 21-32 21S22 71 22 61c0-6 3-11 8-13Z" />
      <path d="M54 26l-8-9 16 0-8 9Z" />
      <path d="M78 52c8-2 14 2 14 8" />
    </>
  ),
  steam: (
    <>
      <path d="M38 78c-9-8-9-19 0-27s9-19 0-27" />
      <path d="M62 78c-9-8-9-19 0-27s9-19 0-27" />
    </>
  ),
  moon: <path d="M64 20a34 34 0 1 0 20 61A28 28 0 0 1 64 20Z" />,
  chair: (
    <>
      <path d="M32 24v40M32 46h30M62 24v40" />
      <path d="M26 64h44l-6 22M32 64l-6 22" />
    </>
  ),
  table: (
    <>
      <path d="M18 44h64" />
      <path d="M26 44l-6 34M74 44l6 34" />
      <path d="M40 30c0 6 8 6 8 0M56 34c0 6 8 6 8 0" />
    </>
  ),
  pin: (
    <>
      <path d="M50 84c0 0-24-24-24-42a24 24 0 0 1 48 0c0 18-24 42-24 42Z" />
      <circle cx="50" cy="42" r="9" />
    </>
  ),
  sparkle: <path d="M50 18c4 18 14 28 32 32-18 4-28 14-32 32-4-18-14-28-32-32 18-4 28-14 32-32Z" />,
};

export function Doodle({
  name,
  size = 96,
  className,
  style,
  strokeWidth = 3,
}: {
  name: DoodleName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
