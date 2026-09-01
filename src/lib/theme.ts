export type ThemeChoice = "system" | "day" | "night";

const KEY = "chaya-theme";
const ORDER: ThemeChoice[] = ["system", "day", "night"];

export function getThemeChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(KEY);
    return v === "day" || v === "night" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  try {
    if (choice === "system") {
      delete el.dataset.theme;
      localStorage.removeItem(KEY);
    } else {
      el.dataset.theme = choice;
      localStorage.setItem(KEY, choice);
    }
  } catch {
    if (choice === "system") delete el.dataset.theme;
    else el.dataset.theme = choice;
  }
}

export function cycleTheme(): ThemeChoice {
  const next = ORDER[(ORDER.indexOf(getThemeChoice()) + 1) % ORDER.length];
  applyTheme(next);
  return next;
}

export function themeLabel(choice: ThemeChoice): string {
  return choice === "system" ? "follows your phone" : choice === "day" ? "always day" : "always night";
}
