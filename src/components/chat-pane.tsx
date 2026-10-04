import { Check, ChevronUp, CornerDownLeft, Plus, Square, Trash2, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSegue } from "@/lib/store";
import type { ChatMessage, Citation } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChatPane() {
  const threads = useSegue((s) => s.threads);
  const chatTabs = useSegue((s) => s.chatTabs);
  const activeThreadId = useSegue((s) => s.activeThreadId);
  const sendChat = useSegue((s) => s.sendChat);
  const stopChat = useSegue((s) => s.stopChat);
  const newChatTab = useSegue((s) => s.newChatTab);
  const selectChatTab = useSegue((s) => s.selectChatTab);
  const closeChatTab = useSegue((s) => s.closeChatTab);
  const streaming = useSegue((s) => s.streaming);
  const aiAvailable = useSegue((s) => s.aiAvailable);
  const [value, setValue] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const thread = threads.find((t) => t.id === activeThreadId);
  const messages = thread?.messages ?? [];

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const onSubmit = () => {
    const t = value.trim();
    if (!t) return;
    setValue("");
    void sendChat(t);
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-bg">
      {/* Tab strip styled after Continue's TabBar: VS Code-style bordered
          tabs hanging from the title bar's bottom border (no top border, so
          the two share one line). Like Chrome's tab strip there is a single
          row: tabs grow to share the bar up to 150px, shrink proportionally
          when crowded, and bottom out at a width that still fits the close
          button — the active tab bottoms out wider, so it stays readable
          longest (Chrome's min-inactive < min-active < preferred widths).
          Past the floors the strip scrolls sideways, never wraps. The plus
          lives in a fixed column outside the scroll area (VS Code's actions
          column). */}
      <header className="relative flex h-[25px] shrink-0 bg-bg">
        <div className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chatTabs.map((id) => {
            const t = threads.find((x) => x.id === id);
            if (!t) return null;
            const active = id === activeThreadId;
            return (
              <div
                key={id}
                title={t.title}
                onClick={() => selectChatTab(id)}
                onAuxClick={(e) => {
                  // Middle mouse button closes, like Continue.
                  if (e.button === 1) {
                    e.preventDefault();
                    closeChatTab(id);
                  }
                }}
                className={cn(
                  "group flex h-[25px] min-w-10 max-w-[150px] shrink basis-[100px] grow cursor-pointer select-none items-center border-x border-b border-border pr-[5px] pl-3 text-[13px] transition-colors duration-200 first:border-l-0 [&+&]:border-l-0",
                  active
                    ? "min-w-12 border-b-0 text-fg"
                    : "text-muted hover:bg-fg/10 hover:text-fg",
                )}
              >
                <span className="min-w-0 flex-1 truncate whitespace-nowrap">{t.title}</span>
                <button
                  type="button"
                  aria-label={`Close ${t.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeChatTab(id);
                  }}
                  className="invisible ml-1 flex size-4 shrink-0 items-center justify-center rounded-sm opacity-70 transition-colors duration-150 group-hover:visible hover:bg-fg/10 hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
          <div className="h-[25px] min-w-0 flex-1 border-b border-border bg-bg" />
        </div>
        <div className="flex h-[25px] shrink-0 items-center border-b border-border bg-bg pr-1 pl-1">
          <button
            type="button"
            aria-label="New thread"
            onClick={newChatTab}
            className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted transition-colors duration-150 hover:bg-fg/10 hover:text-fg"
          >
            <Plus className="size-3.5" />
          </button>
        </div>
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col gap-6 pt-4">
            <div>
              <p className="font-serif text-lg tracking-tight text-fg">Ask the library</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                Answers from the open book, with citations — it can search, read, and jump
                when it needs more.
              </p>
            </div>
          </div>
        )}
        <ol className="space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
        </ol>
        {streaming && messages.at(-1)?.content === "" && (
          <p className="mt-3 font-mono text-xs text-muted">
            <span className="shimmer bg-clip-text text-transparent">thinking</span>
          </p>
        )}
      </div>

      <form
        className="shrink-0 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="@container rounded-lg border border-border bg-bg p-2">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            rows={2}
            placeholder={
              aiAvailable
                ? "Ask about what you're reading…"
                : "AI is not configured — add a provider below"
            }
            disabled={!aiAvailable || streaming}
            suppressHydrationWarning
            className="block w-full resize-none bg-transparent px-1 pt-1 text-sm leading-6 text-fg outline-none placeholder:text-faint disabled:opacity-50"
          />
          <div className="mt-1 flex items-center justify-between px-1">
            <ModelPicker />
            {streaming ? (
              <Button type="button" size="sm" variant="outline" onClick={stopChat}>
                <Square className="size-3" />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                variant="default"
                className="bg-fg"
                disabled={!value.trim() || !aiAvailable}
              >
                Send
                <CornerDownLeft className="size-3" />
              </Button>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

/**
 * Model menu in the composer's bottom row: switch between added providers,
 * remove one, or open the sidebar's add-provider form. With nothing added
 * yet the chip jumps straight to that form.
 */
function ModelPicker() {
  const aiSettings = useSegue((s) => s.aiSettings);
  const selectAiProvider = useSegue((s) => s.selectAiProvider);
  const removeAiProvider = useSegue((s) => s.removeAiProvider);
  const setSidebarView = useSegue((s) => s.setSidebarView);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (!aiSettings) return null;
  const active = aiSettings.providers.find((p) => p.id === aiSettings.activeId) ?? null;

  const openAddProvider = () => {
    setOpen(false);
    setSidebarView("settings");
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Model"
        onClick={() => (aiSettings.providers.length ? setOpen((o) => !o) : openAddProvider())}
        className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted transition-colors duration-150 hover:bg-fg/10 hover:text-fg"
      >
        <span className="max-w-44 truncate">
          {active ? active.model : "Add"}
        </span>
        {active ? <ChevronUp className="size-3.5 shrink-0" /> : null}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-1 w-56 max-w-[calc(100cqw-1rem)] rounded-lg border border-border bg-bg p-1 shadow-[var(--shadow-border)]">
          {aiSettings.providers.map((p, i) => {
            const prev = aiSettings.providers[i - 1];
            return (
              <Fragment key={p.id}>
                {prev && prev.label !== p.label && (
                  <div className="my-1 border-t border-border" />
                )}
                <div className="flex items-center rounded-md hover:bg-black/[13.3%]">
                  <button
                    type="button"
                    onClick={() => {
                      void selectAiProvider(p.id);
                      setOpen(false);
                    }}
                    className="min-w-0 flex-1 px-2 py-1.5 text-left"
                  >
                    <span className="block truncate text-xs leading-4 text-faint">
                      {p.label}
                    </span>
                    <span className="block truncate text-sm leading-6 text-fg">{p.model}</span>
                  </button>
                  {p.id === active?.id ? (
                    <Check className="mr-2 size-4 shrink-0 text-accent" />
                  ) : (
                    <button
                      type="button"
                      aria-label={`Remove ${p.label} · ${p.model}`}
                      onClick={() => void removeAiProvider(p.id)}
                      className="mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-sm text-faint transition-colors duration-150 hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              </Fragment>
            );
          })}
          {aiSettings.providers.length > 0 && <div className="my-1 border-t border-border" />}
          <button
            type="button"
            onClick={openAddProvider}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted transition-colors duration-150 hover:bg-black/[13.3%] hover:text-fg"
          >
            <Plus className="size-3.5 shrink-0" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <li className="ml-6 rounded-lg bg-black/[13.3%] px-3 py-2 text-sm leading-6 text-fg">{message.content}</li>
    );
  }
  return (
    <li>
      {message.toolTrace?.length ? (
        <p className="mb-1 font-mono text-[10px] tracking-wide text-faint uppercase">
          {message.toolTrace.join(" → ")}
        </p>
      ) : null}
      <div className="chat-prose text-sm leading-6 text-fg">
        <ChatBody text={message.content} citations={message.citations ?? []} />
      </div>
      {message.citations && message.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {message.citations.map((c) => (
            <CiteChip key={`${c.chunkId}-${c.locator}`} citation={c} />
          ))}
        </div>
      )}
    </li>
  );
}

function ChatBody({ text, citations }: { text: string; citations: Citation[] }) {
  const parts = text.split(/(\[C\d+\])/g);
  return (
    <div>
      {parts.map((part, i) => {
        const m = part.match(/^\[(C\d+)\]$/);
        if (m) {
          const cit = citations.find((c) => c.chunkId === m[1]);
          if (cit) return <CiteChip key={i} citation={cit} compact />;
          return (
            <span key={i} className="font-mono text-xs text-accent">
              {part}
            </span>
          );
        }
        return <span key={i}>{formatInline(part)}</span>;
      })}
    </div>
  );
}

function formatInline(s: string) {
  const bits = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return bits.map((b, i) => {
    if (b.startsWith("**") && b.endsWith("**")) {
      return <strong key={i}>{b.slice(2, -2)}</strong>;
    }
    if (b.startsWith("`") && b.endsWith("`")) {
      return <code key={i}>{b.slice(1, -1)}</code>;
    }
    return <span key={i}>{b}</span>;
  });
}

function CiteChip({ citation, compact }: { citation: Citation; compact?: boolean }) {
  const jumpTo = useSegue((s) => s.jumpTo);
  return (
    <button
      type="button"
      onClick={() => jumpTo(citation.docId, citation.locator)}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm bg-black/[13.3%] font-mono text-[10px] text-accent transition-colors duration-150 hover:bg-fg/10",
        compact ? "mx-0.5 px-1 py-0.5 align-middle" : "px-1.5 py-1",
      )}
      title={`${citation.docTitle} · ${citation.heading}`}
    >
      {compact ? citation.chunkId : `${citation.docTitle} · ${citation.locator}`}
    </button>
  );
}
