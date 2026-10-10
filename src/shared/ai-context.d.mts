/** Provider-neutral turn, OpenAI-shaped; adapters map it onto their wire. */
export type Turn = {
  role: "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export type ChatContext = {
  systemText: string;
  turns: Turn[];
  tools: readonly unknown[];
  temperature: number;
};

/** Events every provider adapter's parseStream yields (arguments is a JSON
 * string, exactly what the renderer's dispatchChatEvent expects). */
export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "tool_call"; id: string; name: string; arguments: string }
  | { type: "done" }
  | { type: "error"; error: string };

export declare const MAX_OUTPUT_TOKENS: number;

export declare function buildChatContext(
  body: unknown,
): { error: { status: number; message: string } } | ChatContext;
