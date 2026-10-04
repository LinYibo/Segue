import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Load `.env` from the project root into process.env (first write wins — real
 * environment variables always take precedence). Used by the Vite dev config
 * and the Electron main process so API keys (XAI_API_KEY etc.) can live in a
 * local .env file everywhere.
 */
export function loadDotEnv() {
  const path = join(process.cwd(), ".env");
  if (!existsSync(path)) return;
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
}
