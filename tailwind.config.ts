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
      /** 1.2× Tailwind’s default scale; keeps root `rem` unchanged for layout/spacing. */
      fontSize: {
        xs: ["0.9rem", { lineHeight: "1.2rem" }],
        sm: ["1.05rem", { lineHeight: "1.5rem" }],
        base: ["1.2rem", { lineHeight: "1.8rem" }],
        lg: ["1.35rem", { lineHeight: "2.1rem" }],
        xl: ["1.5rem", { lineHeight: "2.1rem" }],
        "2xl": ["1.8rem", { lineHeight: "2.4rem" }],
        "3xl": ["2.25rem", { lineHeight: "2.7rem" }],
        "4xl": ["2.7rem", { lineHeight: "3rem" }],
      },
    },
  },
  plugins: [],
} satisfies Config;
