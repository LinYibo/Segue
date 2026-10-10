import { aiSettingsView, resolveAiConfig } from "@shared/providers.mjs";
import { streamProviderChat } from "@shared/chat.mjs";
import {
  withAddedProvider,
  withRemovedProvider,
  withSelectedProvider,
} from "@shared/settings.mjs";
import type { SegueHost } from "@/lib/platform";
import type { AiSettingsPatch, AiSettingsView } from "@/lib/types";

/**
 * Browser implementation of the host API, the web counterpart of
 * electron/preload.cjs. AI settings live in localStorage under one key in the
 * same JSON shape as the desktop's settings.json — including the API key,
 * which is the standard serverless-web tradeoff (the desktop keeps the key in
 * the main process instead; neither ever hands it back to the UI, only a
 * hasKey flag). Chat requests go straight from the browser to the provider
 * through the shared src/shared pipeline, so endpoints must allow the
 * app's origin (Ollama/LM Studio: enable CORS for it, or run the desktop app).
 */

const STORAGE_KEY = "segue.web.ai.settings";

type SavedSettings = {
  activeId?: string | null;
  providers?: { id: string; provider: string; baseUrl: string; model: string; apiKey?: string }[];
};

function readSettings(): SavedSettings | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedSettings;
  } catch {
    // Unlike a hand-edited settings.json, corrupt localStorage has no
    // repair story — start over rather than brick the app.
    console.warn(`Ignoring unreadable ${STORAGE_KEY}`);
    return null;
  }
}

function writeSettings(data: SavedSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data, null, 2));
}

export function createWebHost(): SegueHost {
  // At most one chat request in flight; a new one supersedes the previous.
  let activeChat: AbortController | null = null;
  const view = (): AiSettingsView => aiSettingsView(readSettings(), {});

  return {
    getAiSettings: async () => view(),

    addAiProvider: async (patch: AiSettingsPatch) => {
      writeSettings(withAddedProvider(readSettings() ?? {}, patch));
      return view();
    },

    selectAiProvider: async (id) => {
      writeSettings(withSelectedProvider(readSettings() ?? {}, id));
      return view();
    },

    removeAiProvider: async (id) => {
      writeSettings(withRemovedProvider(readSettings() ?? {}, id));
      return view();
    },

    chat: (body, onEvent) => {
      activeChat?.abort();
      activeChat = new AbortController();
      return streamProviderChat({
        cfg: resolveAiConfig(readSettings()),
        body,
        signal: activeChat.signal,
        send: onEvent,
      }).then(() => undefined);
    },

    abortChat: () => activeChat?.abort(),

    openExternal: async (url) => {
      // The web equivalent of shell.openExternal: a new browser tab.
      if (/^(https?:|mailto:)/i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
    },
  };
}
