export type DocKind = "pdf" | "epub";

export type SidebarView = "library" | "search" | "highlights" | "settings" | "chat";

// AI provider configuration, mirrored from electron/providers.mjs via the
// settings IPC. The API key itself never crosses IPC — entries carry only a
// hasKey flag, and a saved entry without a key falls back to its preset's
// environment variable.
export type AiProviderPreset = {
  id: string;
  label: string;
  protocol: "openai" | "anthropic" | "google";
  baseUrl: string;
  model: string;
  envKey: string | null;
  envKeySet: boolean;
};

export type AiProviderEntry = {
  id: string;
  provider: string;
  label: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  keyFromEnv: boolean;
};

export type AiSettingsView = {
  activeId: string | null;
  providers: AiProviderEntry[];
  presets: AiProviderPreset[];
};

export type AiSettingsPatch = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
};

// Metadata-only view of the library sent with chat requests, so the model can
// answer "what am I reading" without any cross-book retrieval.
export type LibraryEntry = { title: string; author: string; kind: DocKind };

export type DocMeta = {
  id: string;
  title: string;
  author: string;
  kind: DocKind;
  addedAt: number;
  lastOpenedAt: number;
  size: number;
  pageCount?: number;
  progress: number;
  lastLocator: string;
  excerpt: string;
};

export type Section = {
  locator: string;
  heading: string;
  text: string;
  html?: string;
  src?: string;
  page?: number;
  // The section-level CFI (EPUB spine CFI; PDF's synthetic per-page one) —
  // maps a reading-position CFI back to its section (longest prefix wins).
  cfi?: string;
};

export type ParsedDoc = {
  title: string;
  author: string;
  kind: DocKind;
  sections: Section[];
  pageCount?: number;
  outline?: OutlineItem[];
};

export type Chunk = {
  id: string;
  docId: string;
  locator: string;
  heading: string;
  text: string;
  index: number;
};

export type Highlight = {
  id: string;
  docId: string;
  locator: string;
  text: string;
  note: string;
  createdAt: number;
  // The precise range CFI (EPUB spine sections and PDF page sections alike) —
  // the reader redraws it through foliate's overlayer, no stored geometry
  // needed.
  cfi?: string;
};

export type Citation = {
  chunkId: string;
  docId: string;
  docTitle: string;
  locator: string;
  heading: string;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  toolTrace?: string[];
  createdAt: number;
};

export type Thread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

export type Excerpt = {
  id: string;
  docId: string;
  docTitle: string;
  locator: string;
  heading: string;
  text: string;
};

export type StoredFile = {
  docId: string;
  name: string;
  mime: string;
  bytes: ArrayBuffer;
};

export type OutlineItem = {
  locator: string;
  heading: string;
  level: number;
  // Destination page when known (EPUB ToC entry): outline tracking follows the
  // reading position SumatraPDF-style, the last entry at-or-before the page.
  page?: number;
};
