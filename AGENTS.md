# Segue

Pure web app **and** the trysegue.com site in one: a single Vite + React SPA
at the repo root — an AI-assisted reading workbench for PDF / EPUB. Opening
the site *is* opening the app (no landing page). Read `README.md` for the
architecture.

## Commands

- `npm run dev` — Vite dev server on :5173.
- `npm run build` — static `dist/`.
- `npm run typecheck` / `lint` / `format`.
- **Deploy = push to `main`.** The worker `segue` is connected to
  `LinYibo/Segue` via Workers Builds (configured in the Cloudflare dashboard,
  like worker `gittasks`): a push builds (`npm run build`) and deploys
  `dist/` as static assets per `wrangler.jsonc` — no local deploy command.
  `trysegue.com` + `www` are Workers custom domains on that worker.
- `npm run typecheck` / `lint` / `format`.

## Layout

- Root = the web app: `index.html` + `vite.config.ts` + `src/` (renderer).
  Entry is `src/main.tsx` → installs `src/web-host.ts` (the browser
  `SegueHost`: localStorage settings incl. the API key, direct provider
  fetch) → mounts `src/workbench.tsx` (single document at a time, rail on
  the **left**, browser **native scrollbars**).
- `src/shared/` — browser-safe protocol layer: provider presets, the three
  adapters (OpenAI-compatible / Anthropic / Gemini), context assembly, tools,
  the streaming chat pipeline, and storage-agnostic settings ops. Plain ESM
  `.mjs` with `.d.mts` declarations, imported via the `@shared` alias.
- `src/foliate-js/` — vendored readest foliate-js fork (kept pristine); EPUB
  via the paginator, PDF via foliate-fxl (`@pdfjs` → pdfjs-dist/legacy/build).

## Rules that matter

- **One host API.** Renderer code calls `host()` from `@/lib/platform` —
  never `window.segueHost` directly. The host is installed at boot by the
  entry point; `platform.ts` carries the `SegueHost` type and the accessor.
- **pdf.js assets serve from `./vendor/pdfjs/`** (resolved against the page
  URL): they live in `public/vendor/pdfjs`. Keep the Vite `base: "./"` and
  all local references (favicon icons) relative.
- **AI providers are configured in-app** (rail Settings view): the preset
  table and the three protocol adapters (OpenAI-compatible / Anthropic /
  Gemini) live in `src/shared`. Settings (incl. the API key) persist in
  localStorage under `segue.web.ai.settings`, written only through
  `src/web-host.ts` over the `src/shared/settings.mjs` ops. The UI never
  sees the key — entries carry only a `hasKey` flag. Never reference keys
  from renderer code.
- **Both formats render through the vendored foliate-js fork** (readest's,
  `src/foliate-js`): EPUB via the paginator, PDF via foliate-fxl. The fork
  stays pristine.
- **Single-document model.** The library holds at most one document:
  importing (drop or file picker) replaces the current one and its
  highlights. Chat retrieval is per-book BM25 over the open document only.
