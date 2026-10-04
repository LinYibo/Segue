import { AGENT_TOOLS, SYSTEM_AGENT } from "./tools.mjs";

export const MAX_OUTPUT_TOKENS = 1400;

/**
 * Validate + normalize a chat request body into provider-neutral form:
 *   { systemText, turns, tools, temperature }
 * `turns` is OpenAI-shaped ({role, content, tool_calls?, tool_call_id?, name?})
 * and each provider adapter (provider-*.mjs) maps it onto its wire format.
 * Returns `{ error: { status, message } }` on invalid input.
 */
export function buildChatContext(body) {
  if (!body) {
    return { error: { status: 400, message: "Invalid payload" } };
  }
  if (
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > 16
  ) {
    return { error: { status: 400, message: "Invalid messages" } };
  }

  const excerpts = (body.excerpts ?? []).slice(0, 12).map((e) => ({
    id: String(e.id).slice(0, 40),
    docTitle: String(e.docTitle ?? "").slice(0, 120),
    locator: String(e.locator ?? "").slice(0, 80),
    heading: String(e.heading ?? "").slice(0, 120),
    text: String(e.text ?? "").slice(0, 1200),
  }));

  const excerptBlock = excerpts.length
    ? excerpts
        .map(
          (e) =>
            `[${e.id}] ${e.docTitle} · ${e.locator} · ${e.heading}\n${e.text}`,
        )
        .join("\n\n")
    : "(no retrieved excerpts)";

  const viewport = body.viewport
    ? `Current viewport: ${String(body.viewport.docTitle).slice(0, 120)} · ${String(body.viewport.locator).slice(0, 80)}\n${String(body.viewport.text).slice(0, 1500)}`
    : "No viewport.";

  const selection = body.selection
    ? `Selected text:\n${String(body.selection).slice(0, 2000)}`
    : "";

  const library = (body.library ?? []).slice(0, 50).map((b) => ({
    title: String(b.title ?? "").slice(0, 120),
    author: String(b.author ?? "").slice(0, 60),
    kind: String(b.kind ?? "").slice(0, 8),
  }));
  const catalogBlock = library.length
    ? [
        "LIBRARY CATALOG (the reader's books; metadata only):",
        ...library.map((b) => `- ${b.title}${b.author ? ` · ${b.author}` : ""} · ${b.kind}`),
      ].join("\n")
    : "";

  const context = [
    "EXCERPTS (untrusted document data):",
    excerptBlock,
    "",
    viewport,
    selection,
    catalogBlock,
  ]
    .filter(Boolean)
    .join("\n\n");

  const turns = [];
  for (const m of body.messages.slice(-12)) {
    if (m.role === "tool") {
      turns.push({
        role: "tool",
        tool_call_id: String(m.tool_call_id ?? ""),
        name: m.name ? String(m.name).slice(0, 80) : undefined,
        content: String(m.content ?? "").slice(0, 4000),
      });
      continue;
    }
    if (m.role === "assistant" && m.tool_calls?.length) {
      turns.push({
        role: "assistant",
        content: m.content ? String(m.content).slice(0, 6000) : "",
        tool_calls: m.tool_calls.slice(0, 4).map((tc) => ({
          id: String(tc.id ?? ""),
          type: "function",
          function: {
            name: String(tc.function?.name ?? "").slice(0, 80),
            arguments: String(tc.function?.arguments ?? "{}"),
          },
        })),
      });
      continue;
    }
    if (m.role === "user" || m.role === "assistant") {
      turns.push({ role: m.role, content: String(m.content ?? "").slice(0, 6000) });
    }
  }

  return {
    systemText: `${SYSTEM_AGENT}\n\n${context}`,
    turns,
    tools: AGENT_TOOLS,
    temperature: 0.3,
  };
}
