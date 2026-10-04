import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * App-level AI settings, persisted as <userData>/settings.json and read only
 * by the main process — API keys never cross IPC. Shape:
 *   { activeId?, providers: [{ id, provider, baseUrl, model, apiKey? }] }
 * Each entry overrides its preset's baseUrl/model; a missing apiKey falls
 * back to the preset's environment variable (see providers.mjs).
 */

export function settingsPath(userDataDir) {
  return `${userDataDir}/settings.json`;
}

/** Returns null when no settings file exists yet (normal first run). A
 * present-but-invalid file throws on purpose: hand-edited JSON should fail
 * loudly, not silently reset. */
export function readSettings(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  return JSON.parse(raw);
}

function write(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

/** Append a provider entry and activate it. apiKey semantics: undefined =
 * fall back to the preset's env var, non-empty string = save with the entry. */
export function addProvider(path, patch) {
  const data = readSettings(path) ?? {};
  const entry = {
    id: `pvdr-${randomUUID().slice(0, 8)}`,
    provider: String(patch?.provider ?? "").trim(),
    baseUrl: String(patch?.baseUrl ?? "").trim(),
    model: String(patch?.model ?? "").trim(),
  };
  if (typeof patch?.apiKey === "string" && patch.apiKey.trim()) {
    entry.apiKey = patch.apiKey.trim();
  }
  write(path, { ...data, providers: [...(data.providers ?? []), entry], activeId: entry.id });
}

export function selectProvider(path, id) {
  const data = readSettings(path) ?? {};
  if (!(data.providers ?? []).some((p) => p.id === id)) {
    throw new Error(`Unknown provider ${id}`);
  }
  write(path, { ...data, activeId: id });
}

/** Remove a provider entry; removing the active one activates the first left. */
export function removeProvider(path, id) {
  const data = readSettings(path) ?? {};
  const providers = (data.providers ?? []).filter((p) => p.id !== id);
  write(path, {
    ...data,
    providers,
    activeId: data.activeId === id ? (providers[0]?.id ?? null) : data.activeId,
  });
}
