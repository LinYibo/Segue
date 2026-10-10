import { MAX_OUTPUT_TOKENS } from "./ai-context.mjs";

/** Anthropic Messages API adapter (api.anthropic.com/v1/messages). */

const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Anthropic wants strictly alternating user/assistant turns starting with
 * user; tool results ride in as user messages, so a run of same-role turns
 * is merged into one multi-block message.
 */
function toMessages(turns) {
  const out = [];
  const push = (role, blocks) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.content.push(...blocks);
    else out.push({ role, content: blocks });
  };
  for (const t of turns) {
    if (t.role === "user") {
      push("user", [{ type: "text", text: t.content }]);
    } else if (t.role === "tool") {
      push("user", [{ type: "tool_result", tool_use_id: t.tool_call_id, content: t.content }]);
    } else {
      const blocks = [];
      if (t.content) blocks.push({ type: "text", text: t.content });
      for (const tc of t.tool_calls ?? []) {
        let input = {};
        try {
          input = JSON.parse(tc.function.arguments || "{}");
        } catch {
          input = {};
        }
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
      }
      if (blocks.length) push("assistant", blocks);
    }
  }
  return out;
}

export function buildRequest(cfg, ctx) {
  const payload = {
    model: cfg.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    stream: true,
    temperature: ctx.temperature,
    system: ctx.systemText,
    messages: toMessages(ctx.turns),
  };
  if (ctx.tools) {
    payload.tools = ctx.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  return {
    url: `${cfg.baseUrl.replace(/\/+$/, "")}/v1/messages`,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      // Anthropic's opt-in for direct browser calls (the web app fetches from
      // the renderer's origin); the desktop's main-process fetch ignores it.
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: payload,
  };
}

/** Parse Anthropic's SSE into the app's event objects (same shapes as the
 * OpenAI adapter; tool_use input JSON arrives via input_json_delta chunks). */
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
        let json;
        try {
          json = JSON.parse(trimmed.slice(5).trim());
        } catch {
          continue;
        }
        if (json.type === "content_block_start" && json.content_block?.type === "tool_use") {
          tools.set(json.index, {
            id: json.content_block.id ?? "",
            name: json.content_block.name ?? "",
            arguments: "",
          });
          continue;
        }
        if (json.type === "content_block_delta") {
          if (json.delta?.type === "text_delta" && json.delta.text) {
            yield { type: "delta", text: json.delta.text };
          }
          if (json.delta?.type === "input_json_delta") {
            const cur = tools.get(json.index);
            if (cur) cur.arguments += json.delta.partial_json ?? "";
          }
          continue;
        }
        if (json.type === "error") {
          yield { type: "error", error: json.error?.message ?? "Anthropic stream error" };
        }
      }
    }
    for (const tc of tools.values()) {
      yield { type: "tool_call", id: tc.id, name: tc.name, arguments: tc.arguments || "{}" };
    }
    yield { type: "done" };
  } catch (err) {
    yield {
      type: "error",
      error: err instanceof Error ? err.message : "stream failed",
    };
  }
}
