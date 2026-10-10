import { buildChatContext } from "./ai-context.mjs";
import { adapterFor } from "./providers.mjs";

/**
 * The shared chat pipeline both hosts run — the Electron main process (key
 * held in settings.json / env) and the web app (direct browser fetch):
 * validate the payload, assemble the context, build the provider request,
 * stream the SSE, and forward the app's simple event objects via `send`:
 *   { type: "delta", text }
 *   { type: "tool_call", id, name, arguments }
 *   { type: "done" }
 *   { type: "error", error }
 * `cfg` is the active provider's runtime config (resolveAiConfig); an absent
 * or incomplete one reports "AI is not configured" instead of fetching.
 * Abort via the signal — nothing is sent after an abort.
 */
export async function streamProviderChat({ cfg, body, signal, send }) {
  if (!cfg || !cfg.apiKey || !cfg.baseUrl || !cfg.model) {
    send({ type: "error", error: "AI is not configured — add a provider from the model menu." });
    send({ type: "done" });
    return { ok: false };
  }

  const ctx = buildChatContext(body);
  if ("error" in ctx) {
    send({ type: "error", error: ctx.error.message });
    send({ type: "done" });
    return { ok: false };
  }

  try {
    const adapter = adapterFor(cfg.protocol);
    const req = adapter.buildRequest(cfg, ctx);
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
      signal,
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => "");
      send({
        type: "error",
        error: `${cfg.label} API error ${res.status}${errText ? `: ${errText.slice(0, 200)}` : ""}`,
      });
      send({ type: "done" });
      return { ok: false };
    }
    for await (const ev of adapter.parseStream(res.body)) send(ev);
    return { ok: true };
  } catch (err) {
    if (!signal.aborted) {
      send({
        type: "error",
        error: err instanceof Error ? err.message : "request failed",
      });
      send({ type: "done" });
    }
    return { ok: false };
  }
}
