import type { AiSettingsPatch, AiSettingsView } from "./types";

/**
 * The host API every Segue build runs against. The desktop shell injects it
 * from electron/preload.cjs (contextBridge → window.electronAPI, chat
 * streaming over IPC); the web app installs an equivalent browser
 * implementation at boot (localStorage settings, direct provider fetch).
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

export type PlatformKind = "desktop" | "web";

let kind: PlatformKind =
  typeof window !== "undefined" && "electronAPI" in window ? "desktop" : "web";

/** Entry-point signal. Also paints the platform attribute the shared
 * stylesheet hooks onto (the desktop hides the native reader scrollbars in
 * favor of its own overlay thumb; the web keeps the native ones). */
export function markPlatform(k: PlatformKind) {
  kind = k;
  document.documentElement.dataset.seguePlatform = k;
}

export function platformKind(): PlatformKind {
  return kind;
}

export function isDesktop(): boolean {
  return kind === "desktop";
}

/** The host API; fails loudly if neither shell installed one (broken preload
 * or a web entry that skipped createWebHost). */
export function host(): SegueHost {
  const h = window.electronAPI ?? window.segueHost;
  if (!h) throw new Error("Segue host API missing — preload failed or web host not installed.");
  return h;
}

declare global {
  interface Window {
    electronAPI?: SegueHost;
    segueHost?: SegueHost;
  }
}
