/**
 * Mirror the app's public/ (pdf.js runtime assets, favicons) into the site's
 * public/ — foliate's pdf.js resolves ./vendor/pdfjs/ against the page URL, so
 * the /app.html demo must serve them at /vendor/pdfjs/. The copies are
 * gitignored; run automatically by the dev/build/preview scripts.
 */
import { cpSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const siteDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(siteDir, '..', 'public')
const to = join(siteDir, 'public')

for (const entry of readdirSync(from, { withFileTypes: true })) {
  cpSync(join(from, entry.name), join(to, entry.name), { recursive: true, force: true })
}
console.log('[sync-vendor] mirrored app public/ into site/public/')
