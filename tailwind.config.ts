import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { ink: { DEFAULT: "#12303a", 700: "#1b434f", 900: "#0b1f26" }, accent: { DEFAULT: "#0e7c86", dark: "#0a5f67", soft: "#e3f2f3" }, paper: "#f4f6f6" } } },
  plugins: [],
};
export default config;
