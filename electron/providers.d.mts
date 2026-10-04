export type AiProviderPreset = {
  id: string;
  label: string;
  protocol: "openai" | "anthropic" | "google";
  baseUrl: string;
  model: string;
  envKey: string | null;
};

/** Runtime config: preset defaults merged with the saved settings.json. */
export type AiRuntimeConfig = {
  providerId: string;
  label: string;
  protocol: "openai" | "anthropic" | "google";
  baseUrl: string;
  model: string;
  apiKey: string;
  keyFromEnv: boolean;
};

export declare const PROVIDER_PRESETS: AiProviderPreset[];

export type ProviderAdapter = {
  buildRequest: (
    cfg: AiRuntimeConfig,
    ctx: import("./ai-context.d.mts").ChatContext,
  ) => { url: string; headers: Record<string, string>; body: Record<string, unknown> };
  parseStream: (
    body: ReadableStream<Uint8Array>,
  ) => AsyncGenerator<import("./ai-context.d.mts").ChatEvent>;
};

export declare function adapterFor(protocol: string): ProviderAdapter;
export declare function resolveAiConfig(saved: unknown): AiRuntimeConfig;
