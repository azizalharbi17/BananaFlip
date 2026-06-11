import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // The BananaFlip palette: "fruit-stand finance"
        banana: {
          50: "#FFFBEB",
          100: "#FFF3C4",
          200: "#FFE98A",
          300: "#FFDF5E",
          400: "#FFD23F", // primary banana
          500: "#F5B81C",
          600: "#D99A06",
          700: "#A87102",
        },
        cream: {
          DEFAULT: "#FBF4E2", // page background
          deep: "#F4E8CC",
        },
        paper: "#FFFCF2", // card surfaces

        ink: {
          DEFAULT: "#231A0E", // near-black peel brown
          soft: "#564832",
          faint: "#8A7A60",
        },
        leaf: {
          400: "#4CBB5E",
          500: "#2E9E44",
          600: "#1F7A33",
          700: "#14572A",
        },
        bruise: {
          500: "#E5484D",
          600: "#C03538",
        },
        sky: {
          flip: "#7AC4E8",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "hard-sm": "2px 2px 0 0 #231A0E",
        hard: "4px 4px 0 0 #231A0E",
        "hard-lg": "7px 7px 0 0 #231A0E",
        "hard-banana": "4px 4px 0 0 #D99A06",
      },
      borderRadius: {
        blob: "1.75rem",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "card-flip": {
          "0%": { transform: "perspective(900px) rotateX(-92deg) scale(0.96)", opacity: "0.4" },
          "55%": { transform: "perspective(900px) rotateX(8deg) scale(1.01)", opacity: "1" },
          "100%": { transform: "perspective(900px) rotateX(0deg) scale(1)" },
        },
        "pop-in": {
          "0%": { transform: "scale(0.92) translateY(8px)", opacity: "0" },
          "70%": { transform: "scale(1.015) translateY(-2px)", opacity: "1" },
          "100%": { transform: "scale(1) translateY(0)" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) rotate(-8deg)" },
          "50%": { transform: "translateY(-12px) rotate(4deg)" },
        },
        "bar-grow": {
          "0%": { width: "0%" },
        },
      },
      animation: {
        marquee: "marquee 55s linear infinite",
        "card-flip": "card-flip 0.62s cubic-bezier(0.34, 1.3, 0.5, 1) both",
        "pop-in": "pop-in 0.45s cubic-bezier(0.22, 1.2, 0.36, 1) both",
        wiggle: "wiggle 0.5s ease-in-out",
        "float-slow": "float-slow 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
