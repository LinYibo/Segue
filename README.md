# Segue

AI-assisted reading workbench for **PDF and EPUB** — a **desktop app**
built with **Electron + Vite + React**. Import documents into a local library,
read them with a locator-aware reader (`p.4` for PDF pages, CFI
positions and `ch.2:marginalia` chapters for EPUB), and ask questions that answer from retrieved excerpts with
citations — backed by an agent loop that can search, read, and navigate the
open book with tools when the initial excerpts are thin.

## Architecture

- **Renderer:** Vite + React 19 SPA, Tailwind CSS v4, zustand, pdfjs-dist,
  JSZip, IndexedDB. Retrieval is fully client-side and **per-book**: chunking +
  tokenizer (Latin + CJK bigrams) + BM25 over the open document's chunks only —
  there is no cross-book index. No router — single-page workbench.
- **Main process** (`electron/main.mjs`, plain JS, no bundling): creates the
  window, loads the built renderer from disk (`loadFile`; the build uses
  relative asset paths), and holds the provider API key. Chat streams renderer →
  IPC → main → provider → IPC → renderer.
  `electron/providers.mjs` (presets + protocol registry), `provider-*.mjs`
  (OpenAI-compatible / Anthropic / Gemini adapters), `ai-context.mjs` /
  `tools.mjs` / `env.mjs` / `settings.mjs` hold the shared request assembly,
  prompts/tool definitions, .env loading, and the settings.json persistence.
- **Why a main process at all:** the API key must not live in the
  renderer. Everything else in the app is on-device.

## Getting started

```bash
npm install
npm run dev            # Vite dev server + Electron window (HMR)
```

Production build:

```bash
npm run app            # vite build + launch the desktop app from dist/
```

AI is configured in-app via the rail's Settings view (right edge): pick a
provider — xAI, DeepSeek, OpenRouter, Ollama, LM Studio, Anthropic, Google
Gemini, or any custom OpenAI-compatible endpoint — and save base URL, model,
and API key. Keys persist in `<userData>/settings.json`, read only by the main
process; as a fallback each preset also honors its env var (`XAI_API_KEY`,
`ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, … or a project-root `.env`, loaded by
the main process). Without a key the app runs fine; the chat input points at
Settings.

Everything in the library stays on-device: documents live in IndexedDB and
nothing is uploaded — the model only receives the assembled context window
(viewport, selection, top retrieved chunks of the open book, a metadata-only
library catalog, short thread history).

## Layout

```
index.html            renderer shell (fonts, meta)
src/main.tsx          entry — mounts <Workbench/> in an ErrorBoundary
src/components/       workbench, unified foliate reader, sidebar, chat pane
src/lib/store.ts      zustand store: boot, import, chat threads, highlights
src/lib/parse/        foliate-based parsing (PDF pages / EPUB spine)
src/foliate-js/       vendored readest/foliate-js fork (parsing + reading both formats)
public/vendor/pdfjs/  pdf.js worker, cmaps, standard fonts, wasm decoders
src/lib/bm25.ts       BM25 search over one book's chunks (client-side)
src/lib/ai/           client.ts (IPC chat client), status.ts
electron/main.mjs     window, loadFile/loadURL, IPC (ai:status / settings / ai:chat)
electron/preload.cjs  contextBridge → window.electronAPI
electron/providers.mjs  presets + protocol registry (plain JS)
electron/provider-*.mjs  OpenAI-compat / Anthropic / Gemini adapters
electron/settings.mjs   <userData>/settings.json read/write (key stays in main)
scripts/dev.mjs       dev orchestrator: Vite + Electron
```

## History note

Originally exported from Grok App Builder (TanStack Start + Nitro + platform
services), refactored to plain Vite + React (2026-09-26), then to an
Electron-only desktop app the same day. Pre-refactor snapshots are in git
history.
