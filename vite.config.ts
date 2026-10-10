import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const require = createRequire(import.meta.url);

// Renderer build only — the Electron main process (electron/main.mjs) is plain
// JS and needs no bundling. AI requests go over IPC to the main process, so
// there is no API middleware here. Relative base: production is loaded from
// disk via loadFile, so asset URLs must resolve against index.html.
// The trysegue.com site (site/) is a separate Vite project that embeds this
// renderer source for its browser demo.
export default defineConfig({
  base: "./",
  // Dev on the fixed port scripts/dev.mjs probes and main.mjs loads.
  server: { port: 5173, strictPort: true },
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
    // The foliate-js pdf.js module loads pdf.js through this specifier
    // (readest's vite.config.ts does the same): the legacy build also sets
    // globalThis.pdfjsLib on import, which the module's loader relies on.
    alias: {
      "@pdfjs": join(dirname(require.resolve("pdfjs-dist/package.json")), "legacy", "build"),
    },
  },
});
