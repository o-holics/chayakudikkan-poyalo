"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cycleTheme, getThemeChoice, type ThemeChoice } from "@/lib/theme";
import { Logo } from "@/components/Logo";

const GLYPH: Record<ThemeChoice, string> = { system: "◐", day: "○", night: "●" };

export function AppTopBar({ back }: { back?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(getThemeChoice());
  }, []);

  return (
    <div className="flex items-center justify-between">
      {back ? (
        <Link href={back} className="text-sm text-ink-soft underline decoration-line underline-offset-4">
          back
        </Link>
      ) : (
        <Link href="/home" aria-label="home">
          <Logo size={22} />
        </Link>
      )}
      <div className="flex items-center gap-5 text-ink-soft">
        <button type="button" onClick={() => setChoice(cycleTheme())} aria-label="change theme" className="text-base leading-none">
          {GLYPH[choice]}
        </button>
        <Link href="/you" className="text-sm underline decoration-line underline-offset-4">
          you
        </Link>
      </div>
    </div>
  );
}
