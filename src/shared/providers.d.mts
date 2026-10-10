export type AiProviderPreset = {
  id: string;
  label: string;
  protocol: "openai" | "anthropic" | "google";
  baseUrl: string;
  model: string;
  envKey: string | null;
};

/** Runtime config: preset defaults merged with the saved provider entry. */
export type AiRuntimeConfig = {
  providerId: string;
  label: string;
  protocol: "openai" | "anthropic" | "google";
  baseUrl: string;
  model: string;
  apiKey: string;
  keyFromEnv: boolean;
};

/** What the renderer may see about the AI setup — never a key itself. */
export type AiSettingsView = {
  activeId: string | null;
  providers: {
    id: string;
    provider: string;
    label: string;
    baseUrl: string;
    model: string;
    hasKey: boolean;
    keyFromEnv: boolean;
  }[];
  presets: (AiProviderPreset & { envKeySet: boolean })[];
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
export declare function resolveAiConfig(
  saved: unknown,
  env?: Record<string, string | undefined>,
): AiRuntimeConfig | null;
export declare function resolveEntry(
  entry: { id: string; provider: string; baseUrl: string; model: string; apiKey?: string },
  env?: Record<string, string | undefined>,
): AiRuntimeConfig;
export declare function activeEntry(saved: unknown): { id: string; provider: string } | null;
export declare function aiSettingsView(
  saved: unknown,
  env?: Record<string, string | undefined>,
): AiSettingsView;
