import type { Config } from "tailwindcss";

/**
 * Design tokens extracted from design-reference.html (source of truth).
 * The same values are declared as CSS custom properties in app/globals.css;
 * keep both in sync.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0a0800",
        panel: "#13100a",
        "panel-2": "#181307",
        line: "#2b2210",
        "line-soft": "#1f1909",
        gold: "#f5b912",
        "gold-hi": "#ffd45e",
        ink: "#f3eddd",
        muted: "#9b8d68",
        faint: "#6b6048",
        up: "#16c784",
        down: "#ea3943",
      },
      backgroundImage: {
        "gold-grad": "linear-gradient(135deg,#ffd45e 0%,#f0a90a 100%)",
      },
      borderRadius: {
        r: "16px",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
