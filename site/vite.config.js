import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const require = createRequire(import.meta.url)

// Landing page at / and the in-browser demo at /app.html, built as one static
// site (trysegue.com) deployable on any static host. The demo embeds the app's
// renderer source: `@` reaches it, `@shared` the browser-safe protocol modules
// in src/shared, and `@pdfjs` the pdf.js legacy build resolved from the app's
// root node_modules (the site declares no runtime deps of its own).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Two entries: the landing at / and the in-browser demo at /app.html.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        app: fileURLToPath(new URL('./app.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('../src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../src/shared', import.meta.url)),
      '@pdfjs': join(dirname(require.resolve('pdfjs-dist/package.json')), 'legacy', 'build'),
    },
  },
})
