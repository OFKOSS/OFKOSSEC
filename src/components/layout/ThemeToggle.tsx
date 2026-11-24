import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";
import { cn } from "@/lib/utils";

/** Material icon button that flips between the light and dark colour schemes. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useThemeStore((state) => state.theme);
  const toggle = useThemeStore((state) => state.toggle);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-on-surface/10 hover:text-on-surface",
        className,
      )}
    >
      {isDark ? (
        <Sun className="h-5 w-5" strokeWidth={2} />
      ) : (
        <Moon className="h-5 w-5" strokeWidth={2} />
      )}
    </button>
  );
}
