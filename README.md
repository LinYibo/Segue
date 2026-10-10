# Segue

AI-assisted reading workbench for **PDF and EPUB**. Import a document, read it
with a locator-aware reader (`p.4` for PDF pages, CFI positions and
`ch.2:marginalia` chapters for EPUB), and ask questions that answer from
retrieved excerpts with citations — backed by an agent loop that can search,
read, and navigate the open book when the initial excerpts are thin.

One repo, two products, following the same layout as the GitTasks repo:

- **The desktop app** (this repo root) — Electron + Vite + React.
- **[trysegue.com](https://trysegue.com)** (`site/`) — a standalone Vite
  project: the landing page plus a browser demo of the app at `/app.html`,
  where it runs with a single document at a time, the activity rail on the
  left, and the browser's native scrollbars.

## Architecture

The app lives at the repo root; the site embeds its renderer source for the
browser demo.

- **Renderer** (`src/`, built by the root `vite.config.ts`): React 19 SPA,
  Tailwind CSS v4, zustand, pdfjs-dist, IndexedDB. Retrieval is fully
  client-side and **per-book**: chunking + tokenizer (Latin + CJK bigrams) +
  BM25 over the open document's chunks only — there is no cross-book index.
  Both formats render through the vendored foliate-js fork (`src/foliate-js`):
  EPUB via the paginator, PDF via foliate-fxl.
- **Main process** (`electron/main.mjs`, plain JS, no bundling): creates the
  window, loads the built renderer from disk (`loadFile`; the build uses
  relative asset paths), and holds the provider API key. Chat streams
  renderer → IPC → main → provider → IPC → renderer.
- **Shared protocol layer** (`src/shared/*.mjs` + `.d.mts`): provider presets,
  the three wire adapters (OpenAI-compatible / Anthropic / Gemini), context
  assembly, tool definitions, the streaming chat pipeline, and
  storage-agnostic settings ops. Imported directly by the Node main process
  and bundled by Vite for the site's demo — one chat pipeline for both hosts.
- **Host API** (`src/lib/platform.ts`): every runtime installs the same
  `SegueHost` interface on `window` — the desktop via `contextBridge`
  (`window.electronAPI`, chat over IPC, key in `<userData>/settings.json`),
  the site demo via a boot-time shim (`window.segueHost`, settings in
  localStorage, chat fetched straight from the provider). UI code only ever
  calls `host()`.
- **Site** (`site/`, own `package.json` + lockfile): landing page + demo.
  The demo entry (`site/src/app-entry.jsx`) mounts `src/web/workbench.tsx`
  over the shared renderer source; `@` / `@shared` / `@pdfjs` aliases resolve
  into the repo. No runtime deps of its own, so the landing and the demo
  share one React instance. `scripts/sync-vendor.mjs` mirrors the app's
  `public/vendor/pdfjs` into `site/public` (gitignored) before dev/build —
  foliate's pdf.js resolves `./vendor/pdfjs/` against the page URL.

## Getting started

```bash
npm install
npm run dev            # Vite dev server + Electron window (HMR)
```

Closing the Electron window ends the dev session. Production:

```bash
npm run app            # vite build + launch the desktop app from dist/
```

The site is a standalone project:

```bash
cd site
npm install
npm run dev            # landing + demo on :5173
npm run build          # static dist/ deployable on any host
```

AI is configured in-app via the rail's Settings view (right edge on desktop,
left on the web demo): pick a provider — xAI, DeepSeek, OpenRouter, Ollama,
LM Studio, Anthropic, Google Gemini, or any custom OpenAI-compatible endpoint
— and save base URL, model, and API key. On the desktop, keys persist in
`<userData>/settings.json`, read only by the main process; as a fallback each
preset also honors its env var (`XAI_API_KEY`, `ANTHROPIC_API_KEY`,
`GEMINI_API_KEY`, … or a project-root `.env`, loaded by the main process). In
the browser demo, keys persist in localStorage — the standard serverless-web
tradeoff; endpoints must allow the site's origin (Ollama/LM Studio: enable
CORS, or use the desktop app). Without a key the app runs fine; the chat
input points at Settings.

Everything in the library stays on-device: documents live in IndexedDB and
nothing is uploaded — the model only receives the assembled context window
(viewport, selection, top retrieved chunks of the open book, a metadata-only
library catalog, short thread history).

## Layout

```
package.json           the app (Electron shell + renderer build)
index.html             renderer shell (fonts, meta)
vite.config.ts         renderer build (relative base: production loads from disk)
src/main.tsx           desktop entry — mounts <Workbench/> in an ErrorBoundary
src/workbench.tsx      desktop shell: title-bar tabs, rail on the right edge
src/reader-pane.tsx    desktop reader pane: draggable overlay scrollbar
src/web/               web shell: workbench (single file, rail left, native
                       scrollbars), reader pane, and the browser host shim
src/components/        sidebar + rail, chat pane, settings, foliate reader,
                       selection toolbar
src/lib/store.ts       zustand store: boot, import, chat threads, highlights
src/lib/platform.ts    host API accessor + platform kind (drives CSS gating)
src/lib/parse/         foliate-based parsing (PDF pages / EPUB spine)
src/lib/bm25.ts        BM25 search over one book's chunks (client-side)
src/shared/            browser-safe protocol layer (main process + site demo):
                       providers, adapters, chat pipeline, settings ops
src/foliate-js/        vendored readest/foliate-js fork (kept pristine)
public/vendor/pdfjs/   pdf.js worker, cmaps, standard fonts, wasm decoders
electron/main.mjs      window, loadFile/loadURL, IPC (settings / ai:chat)
electron/preload.cjs   contextBridge → window.electronAPI
electron/settings.mjs  <userData>/settings.json adapter (fs over src/shared ops)
scripts/dev.mjs        dev orchestrator: Vite (pinned :5173) + Electron
site/                  trysegue.com — landing page + /app.html demo
```

## History note

Originally exported from Grok App Builder (TanStack Start + Nitro + platform
services), refactored to plain Vite + React (2026-09-26), then to an
Electron-only desktop app the same day; the browser demo and the trysegue.com
site were added 2026-10-06 following the GitTasks site/app repo layout.
