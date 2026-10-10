export type SavedProvider = {
  id: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

export type SavedSettings = {
  activeId?: string | null;
  providers?: SavedProvider[];
};

export declare function withAddedProvider(
  data: SavedSettings,
  patch: { provider: string; baseUrl: string; model: string; apiKey?: string },
): SavedSettings;

export declare function withSelectedProvider(data: SavedSettings, id: string): SavedSettings;

export declare function withRemovedProvider(data: SavedSettings, id: string): SavedSettings;
