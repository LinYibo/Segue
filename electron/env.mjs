import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Load `.env` into process.env (first write wins — real environment variables
 * always take precedence), so API keys (XAI_API_KEY etc.) can live in a local
 * .env file for the Electron main process. Walks up from the working
 * directory (apps/desktop when run through the workspaces) so a project-root
 * .env keeps working.
 */
export function loadDotEnv() {
  let dir = process.cwd();
  for (;;) {
    const path = join(dir, ".env");
    if (existsSync(path)) {
      for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        const key = m[1];
        let value = m[2].trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}
