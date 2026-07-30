import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7f7",
          500: "#0d9488",
          600: "#0f766e",
          700: "#115e59",
        },
      },
    },
  },
  plugins: [],
};

export default config;
