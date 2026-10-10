import type { AiSettingsPatch, AiSettingsView } from "./types";

/**
 * The host API the app runs against. The entry point installs the browser
 * implementation at boot (src/web-host.ts: localStorage settings, direct
 * provider fetch); renderer code never touches window.segueHost directly.
 */
export type ChatEventLike = {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  arguments?: string;
  error?: string;
};

export type SegueHost = {
  getAiSettings: () => Promise<AiSettingsView>;
  addAiProvider: (patch: AiSettingsPatch) => Promise<AiSettingsView>;
  selectAiProvider: (id: string) => Promise<AiSettingsView>;
  removeAiProvider: (id: string) => Promise<AiSettingsView>;
  chat: (body: unknown, onEvent: (evt: ChatEventLike) => void) => Promise<void>;
  abortChat: () => void;
  openExternal: (url: string) => Promise<void>;
};

/** The host API; fails loudly if the entry point skipped createWebHost. */
export function host(): SegueHost {
  const h = window.segueHost;
  if (!h) throw new Error("Segue host API missing — the web host was not installed.");
  return h;
}

declare global {
  interface Window {
    segueHost?: SegueHost;
  }
}
