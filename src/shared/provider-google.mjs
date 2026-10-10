import { MAX_OUTPUT_TOKENS } from "./ai-context.mjs";

/** Google Gemini adapter (generativelanguage.googleapis.com, SSE streaming). */

/**
 * Gemini requires alternating user/model contents and correlates function
 * results by function name (not call id), so tool messages must carry `name`
 * — the renderer stamps it on every tool turn.
 */
function toContents(turns) {
  const out = [];
  const push = (role, parts) => {
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts.push(...parts);
    else out.push({ role, parts });
  };
  for (const t of turns) {
    if (t.role === "user") {
      push("user", [{ text: t.content }]);
    } else if (t.role === "tool") {
      push("user", [
        { functionResponse: { name: t.name ?? "tool", response: { result: t.content } } },
      ]);
    } else {
      const parts = [];
      if (t.content) parts.push({ text: t.content });
      for (const tc of t.tool_calls ?? []) {
        let args = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        parts.push({ functionCall: { name: tc.function.name, args } });
      }
      if (parts.length) push("model", parts);
    }
  }
  return out;
}

export function buildRequest(cfg, ctx) {
  const payload = {
    systemInstruction: { parts: [{ text: ctx.systemText }] },
    contents: toContents(ctx.turns),
    generationConfig: {
      temperature: ctx.temperature,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    },
  };
  if (ctx.tools) {
    payload.tools = [
      {
        functionDeclarations: ctx.tools.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          parameters: t.function.parameters,
        })),
      },
    ];
  }

  const base = cfg.baseUrl.replace(/\/+$/, "");
  return {
    url: `${base}/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": cfg.apiKey,
    },
    body: payload,
  };
}

/** Parse Gemini's SSE chunks into the app's event objects. Gemini function
 * calls carry no id, so synthetic call ids are generated for round-tripping. */
export async function* parseStream(body) {
  const decoder = new TextDecoder();
  const reader = body.getReader();
  let buf = "";
  let call = 0;
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
        if (json.error?.message) {
          yield { type: "error", error: json.error.message };
          continue;
        }
        for (const part of json.candidates?.[0]?.content?.parts ?? []) {
          if (part.text && !part.thought) yield { type: "delta", text: part.text };
          if (part.functionCall) {
            yield {
              type: "tool_call",
              id: `call_${call++}`,
              name: part.functionCall.name ?? "",
              arguments: JSON.stringify(part.functionCall.args ?? {}),
            };
          }
        }
      }
    }
    yield { type: "done" };
  } catch (err) {
    yield {
      type: "error",
      error: err instanceof Error ? err.message : "stream failed",
    };
  }
}
