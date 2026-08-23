import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#16241C",
          700: "#1F3327",
          500: "#2C4636",
        },
        paper: {
          DEFAULT: "#F1EEE3",
          50: "#F8F6EF",
          100: "#EDE9DA",
          200: "#E1DBC6",
        },
        gold: {
          DEFAULT: "#D9A441",
          600: "#C08F32",
          700: "#9C7326",
        },
        sage: {
          DEFAULT: "#7C8F72",
          600: "#647459",
        },
        brick: {
          DEFAULT: "#9C3B2E",
          600: "#832F24",
        },
      },
      fontFamily: {
        display: ["var(--font-oswald)", "sans-serif"],
        body: ["var(--font-work-sans)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      backgroundImage: {
        "dot-grid":
          "radial-gradient(circle, rgba(22,36,28,0.08) 1px, transparent 1px)",
      },
      backgroundSize: {
        "dot-grid": "16px 16px",
      },
    },
  },
  plugins: [],
};

export default config;
