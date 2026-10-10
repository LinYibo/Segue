import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  withAddedProvider,
  withRemovedProvider,
  withSelectedProvider,
} from "../src/shared/settings.mjs";

/**
 * App-level AI settings, persisted as <userData>/settings.json and read only
 * by the main process — API keys never cross IPC. The entry/domain ops live in
 * src/shared/settings.mjs (shared with the web demo's localStorage host); this
 * module is the file-backed adapter. Shape:
 *   { activeId?, providers: [{ id, provider, baseUrl, model, apiKey? }] }
 * Each entry overrides its preset's baseUrl/model; a missing apiKey falls
 * back to the preset's environment variable (see src/shared/providers.mjs).
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
  write(path, withAddedProvider(readSettings(path) ?? {}, patch));
}

export function selectProvider(path, id) {
  write(path, withSelectedProvider(readSettings(path) ?? {}, id));
}

/** Remove a provider entry; removing the active one activates the first left. */
export function removeProvider(path, id) {
  write(path, withRemovedProvider(readSettings(path) ?? {}, id));
}
