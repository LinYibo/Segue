import type { AiRuntimeConfig } from "./providers.d.mts";
import type { ChatEvent } from "./ai-context.d.mts";

export declare function streamProviderChat(opts: {
  cfg: AiRuntimeConfig | null;
  body: unknown;
  signal: AbortSignal;
  send: (event: ChatEvent) => void;
}): Promise<{ ok: boolean }>;
