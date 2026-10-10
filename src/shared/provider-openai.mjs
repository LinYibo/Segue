import { MAX_OUTPUT_TOKENS } from "./ai-context.mjs";

/**
 * OpenAI-compatible chat adapter: xAI, DeepSeek, OpenRouter, Ollama, LM
 * Studio and any other server speaking the /chat/completions wire format.
 */

export function buildRequest(cfg, ctx) {
  const messages = [{ role: "system", content: ctx.systemText }];
  for (const t of ctx.turns) {
    if (t.role === "assistant" && t.tool_calls?.length) {
      messages.push({ role: "assistant", content: t.content || null, tool_calls: t.tool_calls });
      continue;
    }
    if (t.role === "tool") {
      messages.push({ role: "tool", tool_call_id: t.tool_call_id, content: t.content });
      continue;
    }
    messages.push({ role: t.role, content: t.content });
  }

  const payload = {
    model: cfg.model,
    stream: true,
    temperature: ctx.temperature,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages,
  };
  if (ctx.tools) payload.tools = ctx.tools;

  return {
    url: `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: payload,
  };
}

/** Parse the OpenAI-style SSE stream into the app's simpler event objects:
 *   { type: "delta", text }
 *   { type: "tool_call", id, name, arguments }  (arguments: JSON string)
 *   { type: "done" }
 */
export async function* parseStream(body) {
  const decoder = new TextDecoder();
  const tools = new Map();
  const reader = body.getReader();
  let buf = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n");
      buf = parts.pop() ?? "";
      for (const line of parts) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        const delta = json.choices?.[0]?.delta;
        if (!delta) continue;
        if (delta.content) yield { type: "delta", text: delta.content };
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const cur = tools.get(idx) ?? { id: "", name: "", arguments: "" };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name += tc.function.name;
            if (tc.function?.arguments) cur.arguments += tc.function.arguments;
            tools.set(idx, cur);
          }
        }
      }
    }
    for (const tc of tools.values()) {
      yield { type: "tool_call", id: tc.id, name: tc.name, arguments: tc.arguments };
    }
    yield { type: "done" };
  } catch (err) {
    yield {
      type: "error",
      error: err instanceof Error ? err.message : "stream failed",
    };
  }
}
