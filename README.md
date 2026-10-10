# Segue

AI-assisted reading workbench for **PDF and EPUB**, running entirely in the
browser at [trysegue.com](https://trysegue.com). Import a document, read it
with a locator-aware reader (`p.4` for PDF pages, CFI positions and
`ch.2:marginalia` chapters for EPUB), and ask questions that answer from
retrieved excerpts with citations — backed by an agent loop that can search,
read, and navigate the open book when the initial excerpts are thin.

One document at a time (importing replaces it), the activity rail on the
left, the browser's native scrollbars. Everything stays on-device: documents
live in IndexedDB and nothing is uploaded — the model only receives the
assembled context window (viewport, selection, top retrieved chunks of the
open book, a metadata-only library catalog, short thread history).

## Architecture

- **App** (`src/`, single Vite + React 19 SPA, Tailwind CSS v4, zustand,
  pdfjs-dist, IndexedDB). Retrieval is fully client-side and **per-book**:
  chunking + tokenizer (Latin + CJK bigrams) + BM25 over the open document's
  chunks only — there is no cross-book index. Both formats render through the
  vendored foliate-js fork (`src/foliate-js`): EPUB via the paginator, PDF
  via foliate-fxl.
- **Host API** (`src/lib/platform.ts`): the entry point installs the browser
  implementation (`src/web-host.ts`) on `window.segueHost` before the UI
  mounts — settings in localStorage (including the API key; the UI only ever
  sees a `hasKey` flag), chat fetched straight from the provider through the
  shared pipeline. UI code only ever calls `host()`.
- **Shared protocol layer** (`src/shared/*.mjs` + `.d.mts`): provider presets,
  the three wire adapters (OpenAI-compatible / Anthropic / Gemini), context
  assembly, tool definitions, the streaming chat pipeline, and
  storage-agnostic settings ops. Plain ESM with `.d.mts` type declarations —
  imported by renderer code through the `@shared` alias.
- **Deployment**: `wrangler.jsonc` serves `dist/` as Cloudflare Workers
  static assets (worker `segue`, custom domains `trysegue.com` + `www`).

## Getting started

```bash
npm install
npm run dev            # Vite dev server on :5173
npm run build          # static dist/
npm run deploy         # vite build + wrangler deploy → trysegue.com
```

AI is configured in-app via the rail's Settings view: pick a provider — xAI,
DeepSeek, OpenRouter, Ollama, LM Studio, Anthropic, Google Gemini, or any
custom OpenAI-compatible endpoint — and save base URL, model, and API key.
Keys persist in localStorage under `segue.web.ai.settings`; endpoints must
allow the site's origin (Ollama/LM Studio: enable CORS). Without a key the
app runs fine; the chat input points at Settings.

## Layout

```
index.html             app shell (fonts, meta)
vite.config.ts         build (aliases: @, @shared via tsconfig paths, @pdfjs)
wrangler.jsonc         Workers static-assets deploy config (trysegue.com)
src/main.tsx           entry — installs the web host, mounts <Workbench/>
src/web-host.ts        browser host: localStorage settings, direct fetch
src/workbench.tsx      app shell: single doc, activity rail on the left
src/reader-pane.tsx    reader pane (native scrollbars)
src/components/        sidebar + rail, chat pane, settings, foliate reader,
                       selection toolbar
src/lib/store.ts       zustand store: boot, import, chat threads, highlights
src/lib/platform.ts    SegueHost type + host() accessor
src/lib/parse/         foliate-based parsing (PDF pages / EPUB spine)
src/lib/bm25.ts        BM25 search over one book's chunks (client-side)
src/shared/            browser-safe protocol layer: providers, adapters,
                       chat pipeline, settings ops
src/foliate-js/        vendored readest/foliate-js fork (kept pristine)
public/vendor/pdfjs/   pdf.js worker, cmaps, standard fonts, wasm decoders
                       (resolved against the page URL as ./vendor/pdfjs/)
```

## History note

Originally exported from Grok App Builder (TanStack Start + Nitro + platform
services), refactored to plain Vite + React (2026-09-26), then to an
Electron-only desktop app the same day; the browser demo and the trysegue.com
site were added 2026-10-06 following the GitTasks site/app repo layout, and
on 2026-10-10 the app was reduced to this single pure-web project (the
Electron shell and the landing page were removed; the site now *is* the app).
