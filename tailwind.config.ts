import type { Config } from "tailwindcss";

const themes = {
  light: {
    background: "#ffffff",
    foreground: "#171717",
  },
  dark: {
    background: "#0a0a0a",
    foreground: "#ededed",
  },
  solarized: {
    background: "#fdf6e3",
    foreground: "#657b83",
  },
  forest: {
    background: "#e8f5e9",
    foreground: "#2e7d32",
  },
  neonLight: {
    background: "#ffffff",
    foreground: "#ff4081",
  },
  neonDark: {
    background: "#121212",
    foreground: "#ff4081",
  },
  arcticLight: {
    background: "#e0f7fa",
    foreground: "#01579b",
  },
  arcticDark: {
    background: "#002b36",
    foreground: "#81d4fa",
  },
};

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        theme: themes,
      },
    },
  },
  plugins: [],
} satisfies Config;
