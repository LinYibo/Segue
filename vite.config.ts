import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const require = createRequire(import.meta.url);

// Single static web app: trysegue.com serves the build as Workers static
// assets (wrangler.jsonc). `@` / `@shared` resolve through tsconfig.json's
// paths; `@pdfjs` is the pdf.js legacy build — the foliate-js pdf.js module
// loads pdf.js through that specifier (readest's vite.config.ts does the
// same) and relies on the legacy build setting globalThis.pdfjsLib on import.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@pdfjs": join(dirname(require.resolve("pdfjs-dist/package.json")), "legacy", "build"),
    },
  },
});
