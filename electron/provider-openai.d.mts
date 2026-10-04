export declare function buildRequest(
  cfg: import("./providers.d.mts").AiRuntimeConfig,
  ctx: import("./ai-context.d.mts").ChatContext,
): { url: string; headers: Record<string, string>; body: Record<string, unknown> };

export declare function parseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<import("./ai-context.d.mts").ChatEvent>;
