import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./entrypoints/**/*.{ts,tsx,html}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
