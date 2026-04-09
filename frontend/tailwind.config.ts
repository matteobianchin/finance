import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0f1117",
        card: "#1a1d27",
        border: "#2a2d3a",
        accent: "#3b82f6",
        positive: "#22c55e",
        negative: "#ef4444",
        muted: "#6b7280",
      },
    },
  },
  plugins: [],
};

export default config;
