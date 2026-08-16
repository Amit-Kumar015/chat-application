// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gpt: {
          main: "#212121",       // Main Chat Background
          sidebar: "#171717",    // Sidebar Background
          bubble: "#2f2f2f",     // User Message Bubble & Input Box
          text: "#ECECEC",       // Primary Text
          subtext: "#A0A0A0",    // Secondary/Muted Text
          border: "#333333",     // Subtle Borders
          hover: "#2a2a2a",      // Hover States
          accent: "#10a37f",     // OpenAI Emerald Green
        },
      },
    },
  },
  plugins: [],
};

export default config;