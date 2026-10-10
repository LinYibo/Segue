import { host, type ChatEventLike } from "../platform";
import type { Excerpt, LibraryEntry, ToolCall } from "../types";

export type WireMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  // Function name of the tool result; Gemini needs it to correlate responses.
  name?: string;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
};

export type ChatRequest = {
  messages: WireMessage[];
  excerpts: Excerpt[];
  viewport?: { docTitle: string; locator: string; text: string };
  selection?: string;
  library?: LibraryEntry[];
};

export type StreamHandlers = {
  onDelta: (text: string) => void;
  onToolCall: (call: ToolCall) => void;
  onError: (error: string) => void;
};

function dispatchChatEvent(evt: ChatEventLike, handlers: StreamHandlers) {
  if (evt.type === "delta" && evt.text) handlers.onDelta(evt.text);
  if (evt.type === "tool_call" && evt.id && evt.name) {
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(evt.arguments ?? "{}");
    } catch {
      handlers.onError(`Malformed tool arguments: ${evt.arguments}`);
      return;
    }
    handlers.onToolCall({ id: evt.id, name: evt.name, arguments: args });
  }
  if (evt.type === "error" && evt.error) handlers.onError(evt.error);
}

/**
 * Chat streams through the host API: the desktop's main process holds the
 * configured provider's API key and forwards its SSE as ready-made events;
 * the web host fetches the provider directly with the same event surface.
 */
export async function streamChat(req: ChatRequest, handlers: StreamHandlers, signal?: AbortSignal) {
  const api = host();
  if (signal?.aborted) return;
  signal?.addEventListener("abort", () => api.abortChat(), { once: true });

  await api.chat(
    {
      ...req,
      excerpts: req.excerpts.map((e) => ({
        id: e.id,
        docTitle: e.docTitle,
        locator: e.locator,
        heading: e.heading,
        text: e.text,
      })),
    },
    (evt) => dispatchChatEvent(evt, handlers),
  );
}
