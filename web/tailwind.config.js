/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          900: "#0a0e14",
          800: "#0f1620",
          700: "#161f2c",
          600: "#1f2a3a",
          500: "#2b3a4f",
        },
        profit: "#3ddc97",
        loss: "#ff5c7c",
        warn: "#ffb454",
        accent: "#5b8cff",
      },
    },
  },
  plugins: [],
};
