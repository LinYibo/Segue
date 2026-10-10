import { create } from "zustand";
import { streamChat, type WireMessage } from "./ai/client";
import { searchChunks } from "./bm25";
import { chunkParsed, outlineFromSections } from "./chunk";
import { host } from "./platform";
import { idbDelete, idbDeleteByIndex, idbGetAll, idbGetFile, idbPut, idbPutFile } from "./idb";
import { kindFromName, parseDocument } from "./parse";
import { findQuoteCfi, getBook } from "./parse/foliate";
import type {
  AiSettingsPatch,
  AiSettingsView,
  ChatMessage,
  Chunk,
  Citation,
  DocMeta,
  Excerpt,
  Highlight,
  LibraryEntry,
  OutlineItem,
  Section,
  SidebarView,
  Thread,
  ToolCall,
} from "./types";
import { uid } from "./utils";

type SectionsMap = Record<string, Section[]>;
type OutlinesMap = Record<string, OutlineItem[]>;

type Store = {
  ready: boolean;
  aiAvailable: boolean;
  aiSettings: AiSettingsView | null;
  docs: DocMeta[];
  // Per-book retrieval index. Books are unrelated to each other, so BM25
  // corpus stats stay within one book; there is deliberately no cross-book
  // chunk pool.
  chunks: Record<string, Chunk[]>;
  highlights: Highlight[];
  threads: Thread[];
  // Which threads the chat tab bar shows — a persisted working set on top of
  // the durable thread records (Continue's model: closing a tab keeps the
  // record in IndexedDB).
  chatTabs: string[];
  sections: SectionsMap;
  outlines: OutlinesMap;
  activeDocId: string | null;
  activeLocator: string;
  sidebarView: SidebarView;
  sidebarOpen: boolean;
  railOpen: boolean;
  settingsReturnTo: SidebarView | null;
  activeThreadId: string | null;
  selection: { text: string; locator: string; cfi?: string } | null;
  viewportExcerpt: string;
  importProgress: string | null;
  streaming: boolean;
  docLoadingId: string | null;
  fileCache: Record<string, ArrayBuffer>;
  boot: () => Promise<void>;
  refreshAiSettings: () => Promise<void>;
  addAiProvider: (patch: AiSettingsPatch) => Promise<void>;
  selectAiProvider: (id: string) => Promise<void>;
  removeAiProvider: (id: string) => Promise<void>;
  setSidebarView: (v: SidebarView) => void;
  setSidebarOpen: (v: boolean) => void;
  setRailOpen: (v: boolean) => void;
  closeSettings: () => void;
  openDoc: (id: string, locator?: string) => void;
  setLocator: (locator: string, excerpt?: string) => void;
  setSelection: (sel: Store["selection"]) => void;
  importFiles: (files: FileList | File[]) => Promise<void>;
  removeDoc: (id: string) => Promise<void>;
  addHighlight: (partial: Omit<Highlight, "id" | "createdAt">) => void;
  removeHighlight: (id: string) => void;
  newChatTab: () => void;
  enterChat: () => void;
  selectChatTab: (id: string) => void;
  closeChatTab: (id: string) => void;
  sendChat: (text: string) => Promise<void>;
  stopChat: () => void;
  jumpTo: (docId: string, locator: string) => void;
};

let abortCtl: AbortController | null = null;

const CHAT_TABS_KEY = "segue.chat.tabs";
const CHAT_ACTIVE_KEY = "segue.chat.activeTab";

// The tab bar survives restarts, but its tabs are just ids over the durable
// thread records — same split as Continue (tabs working set / sessions list).
function persistChatTabs(chatTabs: string[], activeThreadId: string | null) {
  localStorage.setItem(CHAT_TABS_KEY, JSON.stringify(chatTabs));
  if (activeThreadId) localStorage.setItem(CHAT_ACTIVE_KEY, activeThreadId);
  else localStorage.removeItem(CHAT_ACTIVE_KEY);
}

function newThread(): Thread {
  return { id: uid("thd"), title: "New thread", messages: [], updatedAt: Date.now() };
}

// Availability derives from the settings view: an active provider entry with a
// key (saved or env fallback), a base URL, and a model.
function isAiAvailable(view: AiSettingsView | null): boolean {
  const active = view?.providers.find((p) => p.id === view.activeId);
  return Boolean(active?.hasKey && active.baseUrl && active.model);
}

export const useSegue = create<Store>((set, get) => ({
  ready: true,
  aiAvailable: true,
  aiSettings: null,
  docs: [],
  chunks: {},
  highlights: [],
  threads: [],
  chatTabs: [],
  sections: {},
  outlines: {},
  activeDocId: null,
  activeLocator: "",
  sidebarView: (localStorage.getItem("segue.sidebar.view") as SidebarView | null) ?? "library",
  sidebarOpen: localStorage.getItem("segue.sidebar.open") !== "false",
  railOpen: localStorage.getItem("segue.rail.open") !== "false",
  settingsReturnTo: null,
  activeThreadId: null,
  selection: null,
  viewportExcerpt: "",
  importProgress: null,
  streaming: false,
  docLoadingId: null,
  fileCache: {},

  boot: async () => {
    try {
      const [allDocs, allHighlights, threads] = await Promise.all([
        idbGetAll("docs"),
        idbGetAll("highlights"),
        idbGetAll("threads"),
      ]);
      let storedDocs = allDocs;
      let highlights = allHighlights;

      // Drop the sample documents that shipped with earlier builds.
      const stale = storedDocs.filter((d) => (d as DocMeta & { isSample?: boolean }).isSample);
      if (stale.length) {
        const staleIds = new Set(stale.map((d) => d.id));
        for (const id of staleIds) {
          await idbDelete("docs", id);
          await idbDelete("files", id);
          await idbDeleteByIndex("highlights", id);
        }
        storedDocs = storedDocs.filter((d) => !staleIds.has(d.id));
        highlights = highlights.filter((h) => !staleIds.has(h.docId));
      }

      // Threads are durable records; the tab bar is the saved working set.
      // Untouched tabs live in memory only, so their ids never validate
      // against the records and drop out here.
      const records = threads
        .filter((t) => t.messages.length > 0)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      const savedTabs: string[] = JSON.parse(localStorage.getItem(CHAT_TABS_KEY) ?? "[]");
      let chatTabs = savedTabs.filter((id) => records.some((t) => t.id === id));
      const savedActive = localStorage.getItem(CHAT_ACTIVE_KEY);
      let threadList = records;
      let activeThreadId = chatTabs.includes(savedActive ?? "")
        ? savedActive!
        : (chatTabs[0] ?? null);
      if (!chatTabs.length) {
        const t = newThread();
        threadList = [...records, t];
        chatTabs = [t.id];
        activeThreadId = t.id;
      }

      set({
        ready: true,
        docs: storedDocs.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
        highlights,
        threads: threadList,
        chatTabs,
        activeDocId: storedDocs[0]?.id ?? null,
        activeLocator: storedDocs[0]?.lastLocator ?? "",
        activeThreadId,
        importProgress: null,
      });

      if (storedDocs[0]) void ensureDocLoaded(storedDocs[0].id);
      void get().refreshAiSettings();
    } catch (err) {
      set({
        ready: true,
        importProgress: err instanceof Error ? err.message : "Failed to open library",
      });
    }
  },

  setSidebarView: (sidebarView) => {
    // Opening the Ask pane lands on the untouched tab when one exists —
    // every path into the pane (rail, ⌘L) gets the same landing.
    if (sidebarView === "chat" && !(get().sidebarOpen && get().sidebarView === "chat")) {
      get().enterChat();
    }
    localStorage.setItem("segue.sidebar.view", sidebarView);
    localStorage.setItem("segue.sidebar.open", "true");
    set({
      sidebarView,
      sidebarOpen: true,
      // The settings form remembers what it replaced so Cancel / a completed
      // add can return there instead of closing the panel.
      settingsReturnTo: sidebarView === "settings" && get().sidebarOpen ? get().sidebarView : null,
    });
  },
  setSidebarOpen: (sidebarOpen) => {
    localStorage.setItem("segue.sidebar.open", String(sidebarOpen));
    set({ sidebarOpen });
  },
  setRailOpen: (railOpen) => {
    localStorage.setItem("segue.rail.open", String(railOpen));
    set({ railOpen });
  },
  closeSettings: () => {
    const back = get().settingsReturnTo;
    if (back) {
      localStorage.setItem("segue.sidebar.view", back);
      set({ sidebarView: back, settingsReturnTo: null });
    } else {
      set({ sidebarOpen: false });
    }
  },
  refreshAiSettings: async () => {
    const view = await host().getAiSettings();
    set({ aiSettings: view, aiAvailable: isAiAvailable(view) });
  },

  addAiProvider: async (patch) => {
    const view = await host().addAiProvider(patch);
    set({ aiSettings: view, aiAvailable: isAiAvailable(view) });
  },

  selectAiProvider: async (id) => {
    const view = await host().selectAiProvider(id);
    set({ aiSettings: view, aiAvailable: isAiAvailable(view) });
  },

  removeAiProvider: async (id) => {
    const view = await host().removeAiProvider(id);
    set({ aiSettings: view, aiAvailable: isAiAvailable(view) });
  },

  openDoc: (id, locator) => {
    const doc = get().docs.find((d) => d.id === id)!;
    const loc = locator ?? doc.lastLocator ?? get().sections[id]?.[0]?.locator ?? "";
    const excerpt = sectionText(get(), id, loc);
    const docs = get().docs.map((d) =>
      d.id === id ? { ...d, lastOpenedAt: Date.now(), lastLocator: loc } : d,
    );
    set({
      activeDocId: id,
      activeLocator: loc,
      docs,
      viewportExcerpt: excerpt,
      selection: null,
    });
    void idbPut("docs", docs.find((d) => d.id === id)!);
    void ensureDocLoaded(id);
  },

  setLocator: (locator, excerpt) => {
    const { activeDocId, docs } = get();
    if (!activeDocId) {
      set({ activeLocator: locator, viewportExcerpt: excerpt ?? get().viewportExcerpt });
      return;
    }
    const next = docs.map((d) => (d.id === activeDocId ? { ...d, lastLocator: locator } : d));
    set({
      activeLocator: locator,
      docs: next,
      viewportExcerpt: excerpt ?? sectionText(get(), activeDocId, locator),
    });
    const updated = next.find((d) => d.id === activeDocId)!;
    void idbPut("docs", updated);
  },

  setSelection: (selection) => set({ selection }),

  importFiles: async (files) => {
    // One document at a time: importing replaces the current one (and its
    // highlights).
    const list = [...files].slice(0, 1);
    const current = get().docs[0];
    if (current) await get().removeDoc(current.id);
    for (const file of list) {
      const kind = kindFromName(file.name);
      if (!kind) {
        set({ importProgress: `Skipped ${file.name} (use PDF or EPUB)` });
        continue;
      }
      set({ importProgress: `Parsing ${file.name}…` });
      try {
        const bytes = await file.arrayBuffer();
        const parsed = await parseDocument(kind, bytes, file.name);
        // Title follows the file name; embedded metadata titles are often
        // internal names that don't match what the user sees in the explorer.
        const title = file.name.replace(/\.(pdf|epub)$/i, "");
        const id = uid("doc");
        set({ importProgress: `Indexing ${title}…` });
        const doc: DocMeta = {
          id,
          title,
          author: parsed.author,
          kind,
          addedAt: Date.now(),
          lastOpenedAt: Date.now(),
          size: file.size,
          lastLocator: parsed.sections[0]?.locator ?? "",
        };
        const newChunks = chunkParsed(id, parsed);
        await idbPut("docs", doc);
        await idbPutFile(id, bytes);
        set((s) => ({
          docs: [doc, ...s.docs],
          chunks: { ...s.chunks, [id]: newChunks },
          sections: { ...s.sections, [id]: parsed.sections },
          outlines: { ...s.outlines, [id]: parsed.outline },
          fileCache: { [id]: bytes },
          activeDocId: id,
          activeLocator: doc.lastLocator,
          viewportExcerpt: parsed.sections[0]?.text.slice(0, 1200) ?? "",
          importProgress: `Indexed ${newChunks.length} chunks`,
        }));
      } catch (err) {
        set({
          importProgress: err instanceof Error ? err.message : `Failed to import ${file.name}`,
        });
      }
    }
    window.setTimeout(() => {
      if (get().importProgress?.startsWith("Indexed")) set({ importProgress: null });
    }, 1800);
  },

  removeDoc: async (id) => {
    await idbDelete("docs", id);
    await idbDelete("files", id);
    await idbDeleteByIndex("highlights", id);
    const { docs, chunks, highlights, sections, outlines, fileCache, activeDocId } = get();
    const nextDocs = docs.filter((d) => d.id !== id);
    const nextId = activeDocId === id ? (nextDocs[0]?.id ?? null) : activeDocId;
    const { [id]: _, ...restSec } = sections;
    const { [id]: __, ...restFiles } = fileCache;
    const { [id]: ___, ...restOut } = outlines;
    const { [id]: ____, ...restChunks } = chunks;
    set({
      docs: nextDocs,
      chunks: restChunks,
      highlights: highlights.filter((h) => h.docId !== id),
      sections: restSec,
      outlines: restOut,
      fileCache: restFiles,
      activeDocId: nextId,
      activeLocator: nextDocs.find((d) => d.id === nextId)?.lastLocator ?? "",
    });
    if (nextId) void ensureDocLoaded(nextId);
  },

  addHighlight: (partial) => {
    const h: Highlight = { ...partial, id: uid("hl"), createdAt: Date.now() };
    set((s) => ({ highlights: [h, ...s.highlights] }));
    void idbPut("highlights", h);
  },

  removeHighlight: (id) => {
    set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) }));
    void idbDelete("highlights", id);
  },

  // Ask pane tabs are threads. The plus button (newChatTab) always spawns a
  // fresh untouched tab; entering the pane (enterChat) lands on the
  // untouched tab when one exists instead of stacking duplicates. Untouched
  // tabs live in memory only, becoming records on the first message. The
  // bar never empties: closing the last tab spawns a fresh one.
  newChatTab: () => {
    const t = newThread();
    set((s) => ({
      threads: [...s.threads, t],
      chatTabs: [...s.chatTabs, t.id],
      activeThreadId: t.id,
    }));
    persistChatTabs(get().chatTabs, t.id);
  },

  enterChat: () => {
    const { threads, chatTabs, activeThreadId } = get();
    const active = threads.find((t) => t.id === activeThreadId);
    if (active && active.messages.length === 0) return;
    const emptyTabId = chatTabs.find(
      (id) => threads.find((t) => t.id === id)?.messages.length === 0,
    );
    if (emptyTabId) {
      set({ activeThreadId: emptyTabId });
      persistChatTabs(get().chatTabs, emptyTabId);
      return;
    }
    get().newChatTab();
  },

  selectChatTab: (id) => {
    set({ activeThreadId: id });
    persistChatTabs(get().chatTabs, id);
  },

  closeChatTab: (id) => {
    const { chatTabs, activeThreadId, threads } = get();
    const idx = chatTabs.indexOf(id);
    if (idx === -1) return;
    // Closing a tab discards the record: the tab bar is the whole history,
    // so there is nothing to reopen and nothing left behind in IndexedDB.
    // Empty tabs have no record yet — the delete is a harmless no-op.
    void idbDelete("threads", id);
    const rest = chatTabs.filter((t) => t !== id);
    const restThreads = threads.filter((t) => t.id !== id);
    if (!rest.length) {
      set({ chatTabs: [], activeThreadId: null, threads: restThreads });
      get().newChatTab();
      return;
    }
    const nextActive =
      activeThreadId === id ? rest[Math.min(idx, rest.length - 1)]! : activeThreadId;
    set({ chatTabs: rest, activeThreadId: nextActive, threads: restThreads });
    persistChatTabs(rest, nextActive);
  },

  sendChat: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().streaming) return;
    const { activeDocId, chunks, docs, sections, selection, viewportExcerpt, activeLocator } =
      get();
    // The tab bar never empties (closeChatTab respawns), so the active
    // thread always resolves.
    const thread = get().threads.find((t) => t.id === get().activeThreadId)!;
    const baseMessages = thread.messages;

    const userMsg: ChatMessage = {
      id: uid("msg"),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    const asstId = uid("msg");
    const asstMsg: ChatMessage = {
      id: asstId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };
    const updatedThread: Thread = {
      ...thread,
      title: baseMessages.length === 0 ? trimmed.slice(0, 48) : thread.title,
      messages: [...baseMessages, userMsg, asstMsg],
      updatedAt: Date.now(),
    };
    set((s) => ({
      threads: s.threads.map((t) => (t.id === updatedThread.id ? updatedThread : t)),
      streaming: true,
      // Direct flags, not setSidebarView: a send keeps the active thread
      // instead of landing on an untouched tab.
      sidebarView: "chat",
      sidebarOpen: true,
    }));
    // The untouched tab exists only in memory, so the record lands in
    // IndexedDB the moment its first message is sent — a crash mid-stream
    // still leaves the conversation in the tab bar after a restart. The
    // empty assistant placeholder stays out of the draft.
    if (baseMessages.length === 0) {
      void idbPut("threads", { ...updatedThread, messages: [userMsg] });
    }

    const query = selection?.text ? `${trimmed}\n\nSelection: ${selection.text}` : trimmed;
    const local = activeDocId ? (chunks[activeDocId] ?? []) : [];
    const excerpts = toExcerpts(
      searchChunks(local, query, 8).map((h) => h.chunk),
      docs,
    );
    // Metadata-only catalog: how ask mode knows what else is in the library
    // without any cross-book retrieval.
    const library = docs.map((d) => ({ title: d.title, author: d.author, kind: d.kind }));

    const viewport = activeDocId
      ? {
          docTitle: docs.find((d) => d.id === activeDocId)?.title ?? "",
          locator: activeLocator,
          text: viewportExcerpt.slice(0, 1500),
        }
      : undefined;

    // Wire history: the previous turns plus this one — the just-appended
    // assistant placeholder stays out.
    const history: WireMessage[] = baseMessages
      .slice(-7)
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content: trimmed });

    abortCtl?.abort();
    abortCtl = new AbortController();

    try {
      await runAgent({
        history,
        excerpts,
        viewport,
        selection: selection?.text,
        asstId,
        threadId: updatedThread.id,
        signal: abortCtl.signal,
        docs,
        chunks,
        sections,
        library,
      });
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") {
        /* stopped */
      } else {
        patchAssistant(updatedThread.id, asstId, (m) => ({
          ...m,
          content: m.content || (err instanceof Error ? err.message : "Something went wrong."),
        }));
      }
    } finally {
      set({ streaming: false });
      const latest = get().threads.find((t) => t.id === updatedThread.id);
      if (latest) void idbPut("threads", latest);
    }
  },

  stopChat: () => {
    abortCtl?.abort();
    abortCtl = null;
    set({ streaming: false });
  },

  jumpTo: (docId, locator) => {
    get().openDoc(docId, locator);
  },
}));

function sectionText(s: { sections: SectionsMap }, docId: string, locator: string): string {
  const list = s.sections[docId] ?? [];
  // EPUB reading positions are CFIs — the section is the longest stored
  // spine-CFI prefix of the position's CFI.
  if (locator.startsWith("epubcfi")) {
    let best: Section | undefined;
    for (const sec of list) {
      if (sec.cfi && locator.startsWith(sec.cfi) && (!best || sec.cfi.length > best.cfi!.length)) {
        best = sec;
      }
    }
    if (best) return best.text.slice(0, 1500);
  }
  // EPUB outline locators may carry a "#fragment" after the section locator.
  const found = list.find((sec) => sec.locator === locator.split("#")[0]) ?? list[0];
  return found?.text.slice(0, 1500) ?? "";
}

function toExcerpts(chunks: Chunk[], docs: DocMeta[]): Excerpt[] {
  return chunks.map((c, i) => ({
    id: `C${i + 1}`,
    docId: c.docId,
    docTitle: docs.find((d) => d.id === c.docId)?.title ?? "Untitled",
    locator: c.locator,
    heading: c.heading,
    text: c.text.slice(0, 1100),
  }));
}

function mergeExcerpts(a: Excerpt[], b: Excerpt[]): Excerpt[] {
  const seen = new Set(a.map((e) => `${e.docId}:${e.locator}:${e.text.slice(0, 40)}`));
  const out = [...a];
  for (const e of b) {
    const k = `${e.docId}:${e.locator}:${e.text.slice(0, 40)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...e, id: `C${out.length + 1}` });
  }
  return out.slice(0, 10);
}

function patchAssistant(threadId: string, asstId: string, fn: (m: ChatMessage) => ChatMessage) {
  useSegue.setState((s) => ({
    threads: s.threads.map((t) =>
      t.id !== threadId
        ? t
        : {
            ...t,
            updatedAt: Date.now(),
            messages: t.messages.map((m) => (m.id === asstId ? fn(m) : m)),
          },
    ),
  }));
}

async function runAgent(opts: {
  history: WireMessage[];
  excerpts: Excerpt[];
  viewport?: { docTitle: string; locator: string; text: string };
  selection?: string;
  asstId: string;
  threadId: string;
  signal: AbortSignal;
  docs: DocMeta[];
  chunks: Record<string, Chunk[]>;
  sections: SectionsMap;
  library: LibraryEntry[];
}) {
  const messages: WireMessage[] = [...opts.history];
  let excerpts = opts.excerpts;
  const trace: string[] = [];
  for (let round = 0; round < 3; round++) {
    let acc = "";
    const toolCalls: ToolCall[] = [];
    await streamChat(
      {
        messages,
        excerpts,
        viewport: opts.viewport,
        selection: opts.selection,
        library: opts.library,
      },
      {
        onDelta: (text) => {
          acc += text;
          patchAssistant(opts.threadId, opts.asstId, (m) => ({
            ...m,
            content: acc,
            citations: citationsFrom(acc, excerpts),
            toolTrace: trace,
          }));
        },
        onToolCall: (call) => toolCalls.push(call),
        onError: (error) => {
          acc = acc || error;
          patchAssistant(opts.threadId, opts.asstId, (m) => ({ ...m, content: acc }));
        },
      },
      opts.signal,
    );
    if (!toolCalls.length) {
      patchAssistant(opts.threadId, opts.asstId, (m) => ({
        ...m,
        content: acc,
        citations: citationsFrom(acc, excerpts),
        toolTrace: trace,
      }));
      return;
    }
    messages.push({
      role: "assistant",
      content: acc,
      tool_calls: toolCalls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: JSON.stringify(c.arguments) },
      })),
    });
    for (const call of toolCalls) {
      const result = await executeTool(call, opts);
      trace.push(`${call.name}`);
      messages.push({ role: "tool", tool_call_id: call.id, name: call.name, content: result.text });
      if (result.excerpts) excerpts = mergeExcerpts(excerpts, result.excerpts);
      patchAssistant(opts.threadId, opts.asstId, (m) => ({
        ...m,
        content: acc || `Using ${call.name}…`,
        toolTrace: [...trace],
      }));
    }
  }
}

async function executeTool(
  call: ToolCall,
  ctx: { docs: DocMeta[]; chunks: Record<string, Chunk[]>; sections: SectionsMap },
): Promise<{ text: string; excerpts?: Excerpt[] }> {
  const arg = (k: string) => String(call.arguments[k] ?? "");
  const store = useSegue.getState();
  // The agent only ever sees the open document.
  const docId = store.activeDocId;
  if (!docId) return { text: "No document is open." };
  switch (call.name) {
    case "search_document": {
      const q = arg("query");
      const hits = searchChunks(ctx.chunks[docId] ?? [], q, 6);
      const excerpts = toExcerpts(
        hits.map((h) => h.chunk),
        ctx.docs,
      );
      const text =
        excerpts
          .map((e) => `[${e.id}] ${e.docTitle} · ${e.locator}\n${e.text.slice(0, 500)}`)
          .join("\n\n") || "No hits.";
      return { text, excerpts };
    }
    case "read_section": {
      const locator = arg("locator");
      const sec = (ctx.sections[docId] ?? []).find((s) => s.locator === locator);
      const doc = ctx.docs.find((d) => d.id === docId);
      if (!sec) return { text: "Section not found." };
      const excerpts: Excerpt[] = [
        {
          id: "Cread",
          docId,
          docTitle: doc?.title ?? "",
          locator,
          heading: sec.heading,
          text: sec.text.slice(0, 1100),
        },
      ];
      return { text: `${doc?.title} · ${locator}\n${sec.text.slice(0, 1800)}`, excerpts };
    }
    case "navigate": {
      const locator = arg("locator");
      store.jumpTo(docId, locator);
      const sec = (ctx.sections[docId] ?? []).find((s) => s.locator === locator);
      return {
        text: sec
          ? `Opened ${locator}. Viewport:\n${sec.text.slice(0, 1200)}`
          : `Opened ${locator}.`,
      };
    }
    case "list_outline": {
      const outline = docOutline(docId);
      const doc = ctx.docs.find((d) => d.id === docId);
      return {
        text: `${doc?.title ?? docId}\n${outline.map((o) => `- ${o.locator}  ${o.heading}`).join("\n")}`,
      };
    }
    case "add_highlight": {
      const locator = arg("locator");
      const quote = arg("quote");
      const geometry = await resolveHighlightGeometry(docId, locator, quote);
      store.addHighlight({
        docId,
        locator,
        text: quote,
        note: arg("note"),
        ...geometry,
      });
      return { text: "Highlight saved." };
    }
    default:
      return { text: `Unknown tool ${call.name}` };
  }
}

// Geometry for an agent-created highlight, resolved at creation time so every
// new highlight renders: the quote's range CFI (EPUB spine sections and PDF
// page sections alike). A quote that can't be found saves without geometry
// and is listed but not drawn.
async function resolveHighlightGeometry(
  docId: string,
  locator: string,
  quote: string,
): Promise<{ cfi?: string }> {
  const s = useSegue.getState();
  const q = quote.trim();
  const file = s.fileCache[docId];
  if (!file || !q) return {};
  const book = await getBook(file);
  const sections = s.sections[docId] ?? [];
  const hint = sections.findIndex(
    (x) => locator === x.locator || locator.startsWith(`${x.locator}#`),
  );
  const order =
    hint >= 0
      ? [hint, ...sections.map((_, i) => i).filter((i) => i !== hint)]
      : sections.map((_, i) => i);
  const cfi = await findQuoteCfi(book, order, q);
  return cfi ? { cfi } : {};
}

function citationsFrom(text: string, excerpts: Excerpt[]): Citation[] {
  const ids = [...text.matchAll(/\[(C\d+)\]/g)].map((m) => m[1]!);
  const uniq = [...new Set(ids)];
  const out: Citation[] = [];
  for (const id of uniq) {
    const e = excerpts.find((x) => x.id === id);
    if (!e) continue;
    out.push({
      chunkId: id,
      docId: e.docId,
      docTitle: e.docTitle,
      locator: e.locator,
      heading: e.heading,
    });
  }
  return out;
}

// Loads a document's bytes from IndexedDB and derives sections, outline, and
// chunks on first touch. Bytes live in fileCache only while their document is
// the active one; derived text is kept for every document opened this session.
// Only files and user data are persisted; nothing document-derived survives a
// restart.
let loadSeq = 0;
async function ensureDocLoaded(id: string) {
  const s = useSegue.getState();
  if (s.fileCache[id] && s.sections[id]) return;
  const seq = ++loadSeq;
  useSegue.setState({ docLoadingId: id });
  try {
    const doc = useSegue.getState().docs.find((d) => d.id === id)!;
    const bytes = await idbGetFile(id);
    if (!bytes) throw new Error(`File data missing for ${doc.title}`);
    if (!useSegue.getState().sections[id]) {
      const parsed = await parseDocument(doc.kind, bytes, doc.title);
      useSegue.setState((st) => ({
        sections: { ...st.sections, [id]: parsed.sections },
        outlines: { ...st.outlines, [id]: parsed.outline },
        chunks: { ...st.chunks, [id]: chunkParsed(id, parsed) },
      }));
    }
    const st = useSegue.getState();
    if (st.activeDocId === id) {
      useSegue.setState({
        fileCache: { [id]: bytes },
        viewportExcerpt: st.viewportExcerpt || st.sections[id]?.[0]?.text.slice(0, 1200) || "",
      });
    }
  } catch (err) {
    useSegue.setState({
      importProgress: err instanceof Error ? err.message : "Failed to open document",
    });
  } finally {
    if (loadSeq === seq) useSegue.setState({ docLoadingId: null });
  }
}

export function docOutline(docId: string): OutlineItem[] {
  const s = useSegue.getState();
  const bookmarked = s.outlines[docId];
  if (bookmarked?.length) return bookmarked;
  return outlineFromSections(s.sections[docId] ?? []);
}
