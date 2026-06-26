/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Forja palette — base escura + acento âmbar (do protótipo)
        forge: {
          bg: "#14110f",
          panel: "#1a1613",
          chrome: "#100e0c",
          deep: "#0f0d0b",
          inset: "#110f0d",
          text: "#f0ebe4",
          muted: "#a39a8e",
          faint: "#6f665c",
          dim: "#5f564c",
        },
        amber: {
          glow: "#f5933f",
          light: "#f5a85e",
          soft: "#f7b377",
          from: "#f9a455",
          to: "#e8792b",
        },
        status: {
          done: "#5bbf8a",
          downloading: "#5b9fd4",
          error: "#e25d4f",
        },
      },
      fontFamily: {
        sans: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
