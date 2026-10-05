import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  FileText,
  Highlighter,
  Library,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { SettingsView } from "@/components/settings-view";
import { searchChunks } from "@/lib/bm25";
import { docOutline, useSegue } from "@/lib/store";
import type { DocKind, OutlineItem, SidebarView } from "@/lib/types";
import { cn, formatBytes } from "@/lib/utils";

export function SidebarPane() {
  const view = useSegue((s) => s.sidebarView);
  return (
    <aside className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex h-10 shrink-0 items-center justify-between px-3">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">
          {view === "settings" ? "Add provider" : view}
        </span>
        {view === "library" ? <ImportButton /> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {view === "library" && <LibraryList />}
        {view === "search" && <SearchList />}
        {view === "highlights" && <HighlightList />}
        {view === "settings" && <SettingsView />}
      </div>
    </aside>
  );
}

function ImportButton() {
  const ref = useRef<HTMLInputElement>(null);
  const importFiles = useSegue((s) => s.importFiles);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept=".pdf,.epub,application/pdf,application/epub+zip"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void importFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button size="iconSm" aria-label="Import document" onClick={() => ref.current?.click()}>
        <Plus className="size-4" />
      </Button>
    </>
  );
}

function LibraryList() {
  const docs = useSegue((s) => s.docs);
  const active = useSegue((s) => s.activeDocId);
  const openDoc = useSegue((s) => s.openDoc);
  const removeDoc = useSegue((s) => s.removeDoc);
  const locator = useSegue((s) => s.activeLocator);
  const outline = active ? docOutline(active) : [];

  return (
    <div className="pb-6">
      <ul className="px-1">
        {docs.map((d) => (
          <li key={d.id}>
            <button
              type="button"
              onClick={() => openDoc(d.id)}
              className={cn(
                "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors duration-150",
                d.id === active
                  ? "bg-black/[13.3%] text-fg"
                  : "text-muted hover:bg-fg/10 hover:text-fg",
              )}
            >
              <KindIcon kind={d.kind} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{d.title}</span>
                <span className="mt-0.5 block truncate text-xs text-faint">
                  {d.author ? `${d.author} · ` : ""}
                  {formatBytes(d.size)}
                </span>
              </span>
              <span
                role="button"
                tabIndex={0}
                className="relative size-7 shrink-0 text-faint hover:text-danger after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2"
                onClick={(e) => {
                  e.stopPropagation();
                  void removeDoc(d.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    void removeDoc(d.id);
                  }
                }}
                aria-label={`Remove ${d.title}`}
              >
                <Trash2 className="mx-auto mt-1.5 size-3.5" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {active && outline.length > 0 && (
        <div className="mt-3 border-t border-border px-1 pt-3">
          <p className="px-2 pb-2 text-xs font-medium tracking-wide text-faint uppercase">
            Outline
          </p>
          <OutlineTree
            key={active}
            nodes={outlineTree(outline)}
            locator={locator}
            onJump={(loc) => openDoc(active, loc)}
          />
        </div>
      )}
    </div>
  );
}

type OutlineNode = OutlineItem & { children: OutlineNode[] };

function pageOf(locator: string): number | undefined {
  const m = /^p\.(\d+)$/.exec(locator);
  return m ? Number(m[1]) : undefined;
}

function outlineTree(items: OutlineItem[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];
  for (const item of items) {
    const node = { ...item, children: [] };
    while (stack.length && stack[stack.length - 1].level >= item.level) stack.pop();
    (stack.length ? stack[stack.length - 1].children : roots).push(node);
    stack.push(node);
  }
  return roots;
}

function OutlineTree({
  nodes,
  locator,
  onJump,
}: {
  nodes: OutlineNode[];
  locator?: string;
  onJump: (loc: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(() => new Set<string>());
  const listRef = useRef<HTMLUListElement>(null);
  const toggle = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  // Follow the reading position like SumatraPDF's TOC: exact entry match
  // first; for paged docs (p.N locators) the last entry at-or-before the
  // current page; otherwise the first entry of the current chapter.
  const base = locator?.split("#")[0] ?? "";
  const activePath = useMemo(() => {
    const find = (
      items: OutlineNode[],
      prefix: string,
      test: (n: OutlineNode) => boolean,
    ): string | null => {
      for (let i = 0; i < items.length; i++) {
        const path = prefix ? `${prefix}.${i}` : String(i);
        if (test(items[i])) return path;
        const deep = find(items[i].children, path, test);
        if (deep) return deep;
      }
      return null;
    };
    const exact = find(nodes, "", (n) => n.locator === locator);
    if (exact) return exact;
    const page = pageOf(locator ?? "");
    if (page !== undefined) {
      let last: string | null = null;
      const walkAll = (items: OutlineNode[], prefix: string) => {
        for (let i = 0; i < items.length; i++) {
          const path = prefix ? `${prefix}.${i}` : String(i);
          const p = pageOf(items[i].locator);
          if (p !== undefined && p <= page) last = path;
          walkAll(items[i].children, path);
        }
      };
      walkAll(nodes, "");
      return last ?? "";
    }
    // EPUB: the reading position is a CFI — the active entry is the deepest
    // outline CFI that is a prefix of it.
    if (locator?.startsWith("epubcfi")) {
      let last: string | null = null;
      let lastLen = 0;
      const walkAll = (items: OutlineNode[], prefix: string) => {
        for (let i = 0; i < items.length; i++) {
          const path = prefix ? `${prefix}.${i}` : String(i);
          const loc = items[i].locator;
          if (loc.startsWith("epubcfi") && locator.startsWith(loc) && loc.length > lastLen) {
            last = path;
            lastLen = loc.length;
          }
          walkAll(items[i].children, path);
        }
      };
      walkAll(nodes, "");
      return last ?? "";
    }
    return find(nodes, "", (n) => n.locator.split("#")[0] === base) ?? "";
  }, [nodes, locator, base]);

  // Ancestor paths of the active entry ("0.2.1" → ["0.2", "0"]).
  const ancestors = useMemo(() => {
    const parts = activePath.split(".");
    if (parts.length < 2) return [];
    return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("."));
  }, [activePath]);

  // Reveal the active entry: expand its ancestors, then scroll it into view
  // ("nearest" never hijacks the list while the user is browsing it).
  useEffect(() => {
    if (!ancestors.length) return;
    setCollapsed((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const p of ancestors) if (next.delete(p)) changed = true;
      return changed ? next : prev;
    });
  }, [ancestors]);
  useEffect(() => {
    if (!activePath) return;
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activePath, collapsed]);

  const render = (node: OutlineNode, path: string, depth: number): ReactNode => (
    <li key={path}>
      <div
        data-active={path === activePath ? "true" : undefined}
        className={cn(
          "flex items-center rounded-md text-xs transition-colors duration-150",
          path === activePath ? "bg-black/[13.3%] text-fg" : "text-muted hover:text-fg",
        )}
        style={{ paddingLeft: Math.min(depth, 6) * 12 }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            aria-label={collapsed.has(path) ? "Expand" : "Collapse"}
            onClick={() => toggle(path)}
            className="flex size-5 shrink-0 items-center justify-center text-faint hover:text-fg"
          >
            {collapsed.has(path) ? (
              <ChevronRight className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            )}
          </button>
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onJump(node.locator)}
          className="min-w-0 flex-1 truncate py-1.5 pr-2 text-left"
        >
          {node.heading}
        </button>
      </div>
      {node.children.length > 0 && !collapsed.has(path) && (
        <ul>{node.children.map((child, i) => render(child, `${path}.${i}`, depth + 1))}</ul>
      )}
    </li>
  );

  return <ul ref={listRef}>{nodes.map((n, i) => render(n, String(i), 0))}</ul>;
}

function SearchList() {
  const [query, setQuery] = useState("");
  const activeDocId = useSegue((s) => s.activeDocId);
  const docs = useSegue((s) => s.docs);
  const chunks = useSegue((s) => s.chunks);
  const highlights = useSegue((s) => s.highlights);
  const jumpTo = useSegue((s) => s.jumpTo);

  const q = query.trim();
  const lower = q.toLowerCase();
  const active = docs.find((d) => d.id === activeDocId);
  const docId = activeDocId ?? "";
  const textHits = useMemo(
    () => (q.length > 1 && activeDocId ? searchChunks(chunks[activeDocId] ?? [], q, 8) : []),
    [q, activeDocId, chunks],
  );
  const headingHits =
    q.length > 1 && activeDocId
      ? docOutline(activeDocId).filter((o) => o.heading.toLowerCase().includes(lower))
      : [];
  const highlightHits =
    q.length > 1 && activeDocId
      ? highlights.filter((h) => h.docId === activeDocId && h.text.toLowerCase().includes(lower))
      : [];
  const nothing = !textHits.length && !headingHits.length && !highlightHits.length;

  return (
    <div className="px-2 pb-6">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-3.5 text-faint" />
        <input
          autoFocus
          data-search-input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search this book…"
          className="h-9 w-full rounded-md border border-border bg-bg pr-3 pl-8 text-sm text-fg outline-none placeholder:text-faint"
        />
      </div>
      {!docId && <p className="px-1 text-xs text-muted">Open a book to search it.</p>}
      {q && docId && nothing && <p className="px-1 text-xs text-muted">No matches.</p>}

      {textHits.length > 0 && (
        <SearchGroup label="Content">
          {textHits.map(({ chunk }) => (
            <li key={chunk.id}>
              <button
                type="button"
                onClick={() => jumpTo(docId, chunk.locator)}
                className="w-full rounded-md px-2 py-2 text-left hover:bg-black/[13.3%]"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-xs text-fg">{chunk.heading || active?.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-faint">{chunk.locator}</span>
                </span>
                <span className="mt-1 line-clamp-2 block font-serif text-xs leading-5 text-muted">
                  {snippet(chunk.text, q)}
                </span>
              </button>
            </li>
          ))}
        </SearchGroup>
      )}

      {headingHits.length > 0 && (
        <SearchGroup label="Headings">
          {headingHits.map((h) => (
            <li key={h.locator}>
              <button
                type="button"
                onClick={() => jumpTo(docId, h.locator)}
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-black/[13.3%]"
              >
                <span className="block truncate text-xs text-fg">{h.heading}</span>
                <span className="mt-0.5 block truncate text-[10px] text-faint">{h.locator}</span>
              </button>
            </li>
          ))}
        </SearchGroup>
      )}

      {highlightHits.length > 0 && (
        <SearchGroup label="Highlights">
          {highlightHits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => jumpTo(docId, h.cfi ?? h.locator)}
                className="w-full rounded-md px-2 py-2 text-left hover:bg-black/[13.3%]"
              >
                <span className="line-clamp-3 block font-serif text-xs leading-5 text-muted">
                  {h.text}
                </span>
                <span className="mt-0.5 block font-mono text-[10px] text-faint">{h.locator}</span>
              </button>
            </li>
          ))}
        </SearchGroup>
      )}
    </div>
  );
}

function snippet(text: string, query: string): string {
  const lowerText = text.toLowerCase();
  let at = -1;
  for (const token of query.toLowerCase().split(/\s+/)) {
    const i = token ? lowerText.indexOf(token) : -1;
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  if (at < 0) return text.slice(0, 120);
  const start = Math.max(0, at - 40);
  const end = Math.min(text.length, at + 80);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function SearchGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-3">
      <p className="px-1 pb-1 text-[10px] font-medium tracking-wide text-faint uppercase">
        {label}
      </p>
      <ul className="space-y-0.5">{children}</ul>
    </section>
  );
}

function HighlightList() {
  const highlights = useSegue((s) => s.highlights);
  const docs = useSegue((s) => s.docs);
  const jumpTo = useSegue((s) => s.jumpTo);
  const removeHighlight = useSegue((s) => s.removeHighlight);

  if (!highlights.length) {
    return (
      <p className="px-4 py-6 text-xs leading-5 text-muted">
        Select text in the reader to highlight a passage.
      </p>
    );
  }

  return (
    <ul className="space-y-1 px-2 pb-6">
      {highlights.map((h) => (
        <li key={h.id} className="group rounded-md px-2 py-2 hover:bg-black/[13.3%]">
          <button
            type="button"
            className="w-full text-left"
            onClick={() => jumpTo(h.docId, h.cfi ?? h.locator)}
          >
            <span className="flex items-center justify-between gap-2 text-[10px] text-faint">
              <span className="truncate">{docs.find((d) => d.id === h.docId)?.title}</span>
              <span className="font-mono">{h.locator}</span>
            </span>
            <span className="mt-1 line-clamp-4 font-serif text-sm leading-5 text-fg">{h.text}</span>
            {h.note ? <span className="mt-1 block text-xs text-muted">{h.note}</span> : null}
          </button>
          <button
            type="button"
            className="mt-1 text-[11px] text-faint hover:text-danger"
            onClick={() => removeHighlight(h.id)}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function KindIcon({ kind }: { kind: DocKind }) {
  const cls = "mt-0.5 size-3.5 shrink-0";
  if (kind === "pdf") return <FileText className={cls} />;
  return <BookMarked className={cls} />;
}

export function ActivityRail() {
  const view = useSegue((s) => s.sidebarView);
  const setView = useSegue((s) => s.setSidebarView);
  const sidebarOpen = useSegue((s) => s.sidebarOpen);
  const setSidebarOpen = useSegue((s) => s.setSidebarOpen);

  const toggleView = (id: SidebarView) => {
    if (view === id && sidebarOpen) {
      setSidebarOpen(false);
    } else {
      setView(id);
    }
  };

  const items = [
    {
      id: "library",
      icon: Library,
      label: "Library",
      active: view === "library" && sidebarOpen,
      run: () => toggleView("library"),
    },
    {
      id: "search",
      icon: Search,
      label: "Search",
      active: view === "search" && sidebarOpen,
      run: () => toggleView("search"),
    },
    {
      id: "highlights",
      icon: Highlighter,
      label: "Highlights",
      active: view === "highlights" && sidebarOpen,
      run: () => toggleView("highlights"),
    },
    {
      id: "ai",
      icon: Sparkles,
      label: "Ask AI",
      active: view === "chat" && sidebarOpen,
      run: () => toggleView("chat"),
    },
  ] satisfies {
    id: string;
    icon: typeof Library;
    label: string;
    active: boolean;
    run: () => void;
  }[];

  return (
    <nav className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-l border-border bg-bg py-2">
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          title={it.label}
          aria-label={it.label}
          onClick={it.run}
          className={cn(
            "relative flex size-11 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:text-fg",
            it.active && "bg-black/[13.3%] text-fg",
          )}
        >
          <it.icon className="size-4" strokeWidth={1.7} />
        </button>
      ))}
    </nav>
  );
}
