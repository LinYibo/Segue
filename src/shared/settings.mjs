/**
 * Provider-entry domain ops over the persisted settings shape — storage
 * agnostic so both hosts share them: the Electron main process applies these
 * before writing <userData>/settings.json, the web app before writing
 * localStorage. Shape:
 *   { activeId?, providers: [{ id, provider, baseUrl, model, apiKey? }] }
 * Each entry overrides its preset's baseUrl/model; a missing apiKey falls
 * back to the preset's environment variable (see providers.mjs).
 */

/** Append a provider entry and activate it. apiKey semantics: undefined =
 * fall back to the preset's env var, non-empty string = save with the entry. */
export function withAddedProvider(data, patch) {
  const entry = {
    id: `pvdr-${crypto.randomUUID().slice(0, 8)}`,
    provider: String(patch?.provider ?? "").trim(),
    baseUrl: String(patch?.baseUrl ?? "").trim(),
    model: String(patch?.model ?? "").trim(),
  };
  if (typeof patch?.apiKey === "string" && patch.apiKey.trim()) {
    entry.apiKey = patch.apiKey.trim();
  }
  return { ...data, providers: [...(data.providers ?? []), entry], activeId: entry.id };
}

export function withSelectedProvider(data, id) {
  if (!(data.providers ?? []).some((p) => p.id === id)) {
    throw new Error(`Unknown provider ${id}`);
  }
  return { ...data, activeId: id };
}

/** Remove a provider entry; removing the active one activates the first left. */
export function withRemovedProvider(data, id) {
  const providers = (data.providers ?? []).filter((p) => p.id !== id);
  return {
    ...data,
    providers,
    activeId: data.activeId === id ? (providers[0]?.id ?? null) : data.activeId,
  };
}
