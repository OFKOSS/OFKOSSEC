/** @type {import('tailwindcss').Config} */

/**
 * Material Design 3 token layer.
 *
 * Every colour is expressed as a CSS variable (defined in src/index.css for both
 * the light and dark scheme) so a single `dark` class on <html> re-themes the
 * whole app without any per-component work.
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        // ---- Material 3 semantic tokens -------------------------------------
        surface: "rgb(var(--md-surface) / <alpha-value>)",
        "surface-container-low": "rgb(var(--md-surface-container-low) / <alpha-value>)",
        "surface-container": "rgb(var(--md-surface-container) / <alpha-value>)",
        "surface-container-high": "rgb(var(--md-surface-container-high) / <alpha-value>)",
        "surface-container-highest": "rgb(var(--md-surface-container-highest) / <alpha-value>)",
        "on-surface": "rgb(var(--md-on-surface) / <alpha-value>)",
        "on-surface-variant": "rgb(var(--md-on-surface-variant) / <alpha-value>)",
        outline: "rgb(var(--md-outline) / <alpha-value>)",
        "outline-variant": "rgb(var(--md-outline-variant) / <alpha-value>)",

        primary: "rgb(var(--md-primary) / <alpha-value>)",
        "on-primary": "rgb(var(--md-on-primary) / <alpha-value>)",
        "primary-container": "rgb(var(--md-primary-container) / <alpha-value>)",
        "on-primary-container": "rgb(var(--md-on-primary-container) / <alpha-value>)",

        secondary: "rgb(var(--md-secondary) / <alpha-value>)",
        "secondary-container": "rgb(var(--md-secondary-container) / <alpha-value>)",
        "on-secondary-container": "rgb(var(--md-on-secondary-container) / <alpha-value>)",

        tertiary: "rgb(var(--md-tertiary) / <alpha-value>)",
        "on-tertiary": "rgb(var(--md-on-tertiary) / <alpha-value>)",
        "tertiary-container": "rgb(var(--md-tertiary-container) / <alpha-value>)",
        "on-tertiary-container": "rgb(var(--md-on-tertiary-container) / <alpha-value>)",

        error: "rgb(var(--md-error) / <alpha-value>)",
        "on-error": "rgb(var(--md-on-error) / <alpha-value>)",
        "error-container": "rgb(var(--md-error-container) / <alpha-value>)",
        "on-error-container": "rgb(var(--md-on-error-container) / <alpha-value>)",

        success: "rgb(var(--md-success) / <alpha-value>)",
        "success-container": "rgb(var(--md-success-container) / <alpha-value>)",
        "on-success-container": "rgb(var(--md-on-success-container) / <alpha-value>)",

        // ---- Legacy aliases -------------------------------------------------
        // The pre-Material markup uses these names everywhere; pointing them at
        // the Material tokens above re-themes every existing screen.
        paper: "rgb(var(--md-surface) / <alpha-value>)",
        "paper-deep": "rgb(var(--md-surface-container) / <alpha-value>)",
        ink: "rgb(var(--md-on-surface) / <alpha-value>)",
        "ink-soft": "rgb(var(--md-on-surface-variant) / <alpha-value>)",
        "ink-faint": "rgb(var(--md-outline) / <alpha-value>)",
        poppy: "rgb(var(--md-primary) / <alpha-value>)",
        "poppy-dark": "rgb(var(--md-primary-hover) / <alpha-value>)",
        cobalt: "rgb(var(--md-tertiary) / <alpha-value>)",
        "cobalt-dark": "rgb(var(--md-tertiary-hover) / <alpha-value>)",
        mustard: "rgb(var(--md-mustard) / <alpha-value>)",
      },
      fontFamily: {
        // Material uses Roboto across headlines, body and labels.
        display: ['"Roboto"', '"Roboto Flex"', "system-ui", "sans-serif"],
        sans: ['"Roboto"', '"Roboto Flex"', "system-ui", "sans-serif"],
        // Roboto Mono is reserved for data (index numbers, tallies).
        mono: ['"Roboto Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        // Material 3 elevation levels.
        "elev-0": "none",
        "elev-1": "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 1px 3px 1px rgb(0 0 0 / 0.15)",
        "elev-2": "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 2px 6px 2px rgb(0 0 0 / 0.15)",
        "elev-3": "0 1px 3px 0 rgb(0 0 0 / 0.30), 0 4px 8px 3px rgb(0 0 0 / 0.15)",
        "elev-4": "0 2px 3px 0 rgb(0 0 0 / 0.30), 0 6px 10px 4px rgb(0 0 0 / 0.15)",
        "elev-5": "0 4px 4px 0 rgb(0 0 0 / 0.30), 0 8px 12px 6px rgb(0 0 0 / 0.15)",
        // Legacy names kept so older markup inherits Material elevation.
        "stamp-sm": "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 1px 3px 1px rgb(0 0 0 / 0.15)",
        stamp: "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 2px 6px 2px rgb(0 0 0 / 0.15)",
        "stamp-lg": "0 1px 3px 0 rgb(0 0 0 / 0.30), 0 4px 8px 3px rgb(0 0 0 / 0.15)",
        "stamp-poppy": "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 2px 6px 2px rgb(0 0 0 / 0.15)",
        "stamp-cobalt": "0 1px 2px 0 rgb(0 0 0 / 0.30), 0 2px 6px 2px rgb(0 0 0 / 0.15)",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        stampIn: {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pop: {
          "0%": { transform: "scale(1)" },
          "45%": { transform: "scale(1.09)" },
          "100%": { transform: "scale(1)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(100%)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fadeUp 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "stamp-in": "stampIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 0.3s ease-out",
        "slide-up": "slideUp 0.25s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
