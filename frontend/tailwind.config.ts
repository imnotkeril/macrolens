import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
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
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
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
