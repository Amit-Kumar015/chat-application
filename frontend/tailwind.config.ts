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
          sidebar: "#171717",
          main: "#212121",
          input: "#2f2f2f",
          hover: "#2a2a2a",
          border: "#333333",
          text: "#ececec",
          subtext: "#b4b4b4",
          accent: "#10a37f",
        },
      },
    },
  },
  plugins: [],
};
export default config;