import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// Tauri expects a fixed port and access to the workspace catalog package source.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // exact-match only, so subpaths like "@forja/catalog/catalog.json"
      // still resolve through the package's exports map
      {
        find: /^@forja\/catalog$/,
        replacement: fileURLToPath(
          new URL("../../packages/catalog/schema.ts", import.meta.url)
        ),
      },
    ],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      // allow importing from the workspace catalog package (outside app root)
      allow: [fileURLToPath(new URL("../../", import.meta.url))],
    },
  },
});
