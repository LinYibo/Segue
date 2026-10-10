# Segue

Electron + Vite + React desktop app **and** the trysegue.com site (`site/`,
landing page + browser demo) — an AI-assisted reading workbench for PDF /
EPUB. Repo layout follows the GitTasks convention: the app lives at the repo
root, the site is a standalone Vite project under `site/`. Read `README.md`
for the architecture.

## Commands

- `npm run dev` — Vite dev server + Electron window (HMR). `scripts/dev.mjs`
  pins Vite to :5173; closing the Electron window ends the session.
- `npm run app` — `vite build` + launch the desktop app from `dist/`.
- `npm run typecheck` / `lint` / `format` — the app and its renderer source.
- Site (standalone project): `cd site && npm run dev` (:5173, landing at /
  and demo at /app.html) / `npm run build`.
- Site deploy: `cd site && npm run build && npx wrangler deploy` — pushes
  `dist/` as Workers static assets (worker `segue`, per `site/wrangler.jsonc`)
  to the account that serves trysegue.com; `trysegue.com` + `www` are bound
  as Workers custom domains (attaching one auto-creates its DNS record).
  wrangler auth is the account's stored OAuth login (wrangler login).

## Layout

- Root = the desktop app: `index.html` + `vite.config.ts` + `src/` (renderer)
  + `electron/` (plain-JS main process, preload) + `scripts/` (dev
  orchestrator, icon generation).
- `src/web/` — the web shell used by the site's demo: `workbench.tsx`
  (single file at a time, rail on the **left**, browser **native
  scrollbars**), `reader-pane.tsx`, and `web-host.ts` (the browser
  `SegueHost`: localStorage settings, direct provider fetch).
- `src/shared/` — browser-safe protocol layer shared by the Node main process
  (relative import, no bundling) and the site demo (bundled by Vite):
  provider presets, the three adapters, context assembly, tools, the
  streaming chat pipeline, and storage-agnostic settings ops.
- `site/` — standalone Vite project (own package.json/lockfile, no runtime
  deps so the demo shares the app's single React instance): landing page at
  `/`, demo at `/app.html` via `site/src/app-entry.jsx`, which installs the
  web host and mounts `src/web/workbench.tsx` over the shared renderer source
  (`@` / `@shared` / `@pdfjs` aliases point into the repo).

## Rules that matter

- **Electron main process is plain JS** (`electron/*.mjs`) — no bundling
  step; Node loads it directly. Shared logic with typechecking lives in
  `.d.mts` declaration files (own ones + `src/shared`'s).
- **One host API, two implementations.** Renderer code calls `host()` from
  `@/lib/platform` — never `window.electronAPI` directly. Desktop exposes
  `window.electronAPI` (preload, chat over IPC, key stays in the main
  process); the site demo exposes `window.segueHost` (localStorage settings,
  direct fetch; the key lives in the browser). Platform differences
  (single-file imports on web, scrollbar styles, hover-zone sensing) branch
  on `isDesktop()`; the shared stylesheet gates the desktop's scrollbar
  hiding on the `data-segue-platform="desktop"` attribute.
- **pdf.js assets serve from `./vendor/pdfjs/`** (resolved against the page
  URL): the app's `public/vendor/pdfjs` is mirrored into `site/public` by
  `site/scripts/sync-vendor.mjs` (gitignored; runs via predev/prebuild
  hooks). Keep the Vite `base: "./"` and all local references (favicon
  icons) relative, or they break on `file://`. Current Electron (44) loads
  ES-module scripts from `file://` fine.
- **AI providers are configured in-app** (rail Settings view): the preset
  table and the three protocol adapters (OpenAI-compatible / Anthropic /
  Gemini) live in `src/shared`. On the desktop, keys persist in
  `<userData>/settings.json`, read/written only by the main process
  (`electron/settings.mjs` — the fs adapter over `src/shared/settings.mjs`);
  the site demo keeps them in localStorage. **API keys never cross IPC** and
  never round-trip back into the renderer — entries carry only a `hasKey`
  flag. Env-var fallback (`XAI_API_KEY`, `ANTHROPIC_API_KEY`, …; project-root
  `.env`, loaded by walking up from the main process's cwd) applies to the
  desktop only. Never reference keys from renderer code.
- **Both formats render through the vendored foliate-js fork** (readest's,
  `src/foliate-js`): EPUB via the paginator, PDF via foliate-fxl (`pdf.js`
  module + `@pdfjs` → `pdfjs-dist/legacy/build`). The fork stays pristine.
- **Site imports point into the repo** (`../src` via `@`): don't copy app
  code into `site/`, and don't give `site/` runtime dependencies — the
  landing and the demo must keep one React instance.
