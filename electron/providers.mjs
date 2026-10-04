import * as anthropic from "./provider-anthropic.mjs";
import * as google from "./provider-google.mjs";
import * as openai from "./provider-openai.mjs";

/**
 * Provider presets. `protocol` picks the wire adapter; `baseUrl`/`model` are
 * editable defaults the renderer settings form fills in; `envKey` names the
 * environment variable used when no key is saved in settings.json (null for
 * keyless-local or bring-your-own providers).
 */
export const PROVIDER_PRESETS = [
  {
    id: "xai",
    label: "xAI (Grok)",
    protocol: "openai",
    baseUrl: "https://api.x.ai/v1",
    model: "grok-4.5",
    envKey: "XAI_API_KEY",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    protocol: "openai",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    envKey: "DEEPSEEK_API_KEY",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    protocol: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4.5",
    envKey: "OPENROUTER_API_KEY",
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    protocol: "openai",
    baseUrl: "http://localhost:11434/v1",
    model: "",
    envKey: null,
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    protocol: "openai",
    baseUrl: "http://localhost:1234/v1",
    model: "",
    envKey: null,
  },
  {
    id: "anthropic",
    label: "Anthropic",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
    envKey: "ANTHROPIC_API_KEY",
  },
  {
    id: "google",
    label: "Google Gemini",
    protocol: "google",
    baseUrl: "https://generativelanguage.googleapis.com",
    model: "gemini-2.5-flash",
    envKey: "GEMINI_API_KEY",
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    protocol: "openai",
    baseUrl: "",
    model: "",
    envKey: null,
  },
];

const ADAPTERS = { openai, anthropic, google };

export function adapterFor(protocol) {
  const adapter = ADAPTERS[protocol];
  if (!adapter) throw new Error(`No adapter for protocol "${protocol}"`);
  return adapter;
}

/** The active entry: the saved activeId, else the first added provider. */
export function activeEntry(saved) {
  const providers = saved?.providers ?? [];
  return providers.find((p) => p.id === saved?.activeId) ?? providers[0] ?? null;
}

/** Merge one saved entry with its preset into a runtime config. Unknown
 * provider ids throw — settings.json is either app-written or hand-edited,
 * and hand-edited files should fail loudly. */
export function resolveEntry(entry) {
  const preset = PROVIDER_PRESETS.find((p) => p.id === entry.provider);
  if (!preset) throw new Error(`Unknown provider "${entry.provider}"`);
  const envKey = preset.envKey ? process.env[preset.envKey] : undefined;
  return {
    id: entry.id,
    providerId: preset.id,
    label: preset.label,
    protocol: preset.protocol,
    baseUrl: String(entry.baseUrl || preset.baseUrl || "").trim(),
    model: String(entry.model || preset.model || "").trim(),
    apiKey: String(entry.apiKey || envKey || "").trim(),
    keyFromEnv: !entry.apiKey && Boolean(envKey),
  };
}

/** Runtime config for the active entry, or null before any provider is added. */
export function resolveAiConfig(saved) {
  const entry = activeEntry(saved);
  return entry ? resolveEntry(entry) : null;
}
