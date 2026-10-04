export declare function settingsPath(userDataDir: string): string;

export type SavedSettings = {
  activeId?: string | null;
  providers?: { id: string; provider: string; baseUrl: string; model: string; apiKey?: string }[];
};

export declare function readSettings(path: string): SavedSettings | null;

export declare function addProvider(
  path: string,
  patch: { provider: string; baseUrl: string; model: string; apiKey?: string },
): void;

export declare function selectProvider(path: string, id: string): void;

export declare function removeProvider(path: string, id: string): void;
