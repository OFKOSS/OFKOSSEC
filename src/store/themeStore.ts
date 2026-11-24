import { create } from "zustand";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ofkossec-theme";

/**
 * Dark is the school's default. The OS preference is deliberately ignored so
 * every visitor gets the intended look; only an explicit switch to light,
 * recorded under THEME_STORAGE_KEY, opts out.
 */
function readInitialTheme(): Theme {
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem(THEME_STORAGE_KEY) === "light") return "light";
    } catch {
      // Storage can be unavailable (private mode) — fall through to dark.
    }
  }
  return "dark";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readInitialTheme(),

  setTheme: (theme) => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can be unavailable (private mode) — the DOM class still applies.
    }
    set({ theme });
  },

  toggle: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
}));
