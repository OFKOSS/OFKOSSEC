import { create } from "zustand";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "ofkossec-theme";

function systemTheme(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Read the theme the inline <head> script already applied, falling back to the OS. */
function readInitialTheme(): Theme {
  if (typeof document !== "undefined") {
    const fromDom = document.documentElement.classList.contains("dark") ? "dark" : "light";
    if (fromDom === "dark") return "dark";
  }
  if (typeof window !== "undefined") {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  }
  return systemTheme();
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
