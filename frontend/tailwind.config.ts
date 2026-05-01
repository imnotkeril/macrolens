import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /** Dark Fintech — UI spec (MacroLens dashboard) */
        tn: {
          canvas: "#0B0E12",
          panel: "#111417",
          card: "#151A1F",
          border: "#23282F",
          sidebar: "#0F1317",
          sidebarActive: "#1A2026",
          sidebarHover: "#171C22",
          cream: "#E6E8EA",
          secondary: "#9AA1A9",
          muted: "#6F7782",
          accent: "#FFFFFF",
          positive: "#49D17D",
          negative: "#FF5C5C",
          macro: "#4F8DF7",
          value: "#F2C94C",
          purple: "#A78BFA",
          orange: "#F2994A",
          scale: "#2A3037",
          chartGreen: "#63E39A",
          chartRed: "#FF6B6B",
          chartBlue: "#5DA9FF",
          chartNeutral: "#7F8C8D",
        },
        "surface-lighter": "rgba(255,255,255,0.06)",
        bg: {
          DEFAULT: "#07070a",
          card: "rgba(255,255,255,0.025)",
          elevated: "rgba(255,255,255,0.05)",
          hover: "rgba(255,255,255,0.07)",
        },
        border: {
          DEFAULT: "rgba(255,255,255,0.06)",
          strong: "rgba(255,255,255,0.12)",
        },
        accent: {
          DEFAULT: "#a78bfa",
          dim: "#7c3aed",
          green: "#34d399",
          red: "#f87171",
          amber: "#fbbf24",
          blue: "#60a5fa",
        },
        text: {
          primary: "#e4e4e7",
          secondary: "#a1a1aa",
          muted: "#52525b",
        },
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out both",
        "slide-up": "slideUp 0.5s ease-out both",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(167,139,250,0.15)" },
          "50%": { boxShadow: "0 0 40px rgba(167,139,250,0.3)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
