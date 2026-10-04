import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Renderer build only — the Electron main process (electron/main.mjs) is plain
// JS and needs no bundling. AI requests go over IPC to the main process, so
// there is no API middleware here. Relative base: production is loaded from
// disk via loadFile, so asset URLs must resolve against index.html.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
    // The foliate-js pdf.js module loads pdf.js through this specifier
    // (readest's vite.config.ts does the same): the legacy build also sets
    // globalThis.pdfjsLib on import, which the module's loader relies on.
    alias: {
      "@pdfjs": fileURLToPath(new URL("./node_modules/pdfjs-dist/legacy/build", import.meta.url)),
    },
  },
});
