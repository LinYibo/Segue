# Segue

Electron + Vite + React desktop app: AI-assisted reading workbench for
PDF / EPUB. No web deployment — the only runtime is the desktop
shell. Read `README.md` for architecture details.

## Commands

- `npm run dev` — Vite dev server + Electron window (HMR). `scripts/dev.mjs`
  reuses an already-running Vite on :5173 instead of spawning a second one.
  Closing the Electron window ends the session.
- `npm run app` — `vite build` + launch the desktop app from `dist/`.
- `npm run typecheck` / `lint` / `format`.

## Rules that matter

- **Electron main process is plain JS** (`electron/*.mjs`) — no bundling step;
  Node loads it directly. Shared logic with typechecking lives in
  `electron/*.d.mts` declaration files.
- **No web mode.** The renderer talks to the main process over IPC
  (`window.electronAPI`, exposed by `electron/preload.cjs`). There is no API
  middleware, no node server, no fetch-based chat path.
- **Production loads `dist/index.html` via `loadFile`** — keep the Vite
  `base: "./"` and all local references (favicon icons) relative, or they
  break on `file://`. Current Electron (44) loads ES-module
  scripts from `file://` fine; no custom protocol is needed.
- **AI providers are configured in-app** (rail Settings view → sidebar): the
  preset table and the three protocol adapters (OpenAI-compatible / Anthropic /
  Gemini) live in `electron/providers.mjs` + `electron/provider-*.mjs`. Config
  persists in `<userData>/settings.json`, read/written only by the main
  process (`electron/settings.mjs`). **API keys never cross IPC** — the key
  comes from settings.json or the provider's env var (`XAI_API_KEY`,
  `ANTHROPIC_API_KEY`, …; a project-root `.env` is loaded by the main
  process). Never reference keys from renderer code.
- **Both formats render through the vendored foliate-js fork** (readest's,
  `src/foliate-js`): EPUB via the paginator, PDF via foliate-fxl
  (`pdf.js` module + `@pdfjs` → `pdfjs-dist/legacy/build`). The pdf.js worker,
  cmaps, standard fonts and wasm decoders are static assets under
  `public/vendor/pdfjs/` — paths inside the fork's `pdf.js` are relative
  (`./vendor/pdfjs/`) so they resolve both in dev and from `file://`.
