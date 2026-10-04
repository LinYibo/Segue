import { useEffect, useRef } from "react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { ActivityRail, SidebarPane } from "@/components/sidebar-pane";
import { ChatPane } from "@/components/chat-pane";
import { ReaderPane } from "@/components/reader-pane";
import { useSegue } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Workbench() {
  const boot = useSegue((s) => s.boot);
  const setSidebarView = useSegue((s) => s.setSidebarView);
  const importFiles = useSegue((s) => s.importFiles);
  const importProgress = useSegue((s) => s.importProgress);
  const sidebarOpen = useSegue((s) => s.sidebarOpen);
  const railOpen = useSegue((s) => s.railOpen);
  const setRailOpen = useSegue((s) => s.setRailOpen);
  const sidebarView = useSegue((s) => s.sidebarView);
  const openTabs = useSegue((s) => s.openTabs);
  const docs = useSegue((s) => s.docs);
  const activeDocId = useSegue((s) => s.activeDocId);
  const openDoc = useSegue((s) => s.openDoc);
  const closeTab = useSegue((s) => s.closeTab);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSidebarView("search");
        window.setTimeout(
          () => document.querySelector<HTMLInputElement>("[data-search-input]")?.focus(),
          0,
        );
      }
      if (meta && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setSidebarView("library");
      }
      if (meta && e.key.toLowerCase() === "l") {
        e.preventDefault();
        setSidebarView("chat");
        document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSidebarView]);

  return (
    <div
      ref={dropRef}
      className="flex h-dvh min-h-0 flex-col bg-bg text-fg"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files);
      }}
    >
      {/* Title bar: drag strip with document tabs. pr-[138px] clears the
          native min/max/close overlay (137px: three 45px buttons with 1px
          spacing) plus the 1px that separates the hide-rail button from it. */}
      <header className="flex h-9 shrink-0 items-center border-b border-border bg-bg pr-[138px] [-webkit-app-region:drag]">
        <span className="flex items-center pl-4 pr-3 text-sm font-medium tracking-tight">Segue</span>
        {/* The strip itself stays draggable (it inherits the header's drag
            region); only each tab opts out so clicks reach it. */}
        <div className="scrollbar-thin flex h-7 min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {openTabs.map((id) => {
            const tabDoc = docs.find((d) => d.id === id);
            if (!tabDoc) return null;
            const active = id === activeDocId;
            return (
              <div
                key={id}
                className={cn(
                  "group flex h-7 shrink-0 items-center gap-0.5 rounded-md pl-2.5 pr-1 text-xs [-webkit-app-region:no-drag]",
                  active
                    ? "bg-black/[13.3%] text-fg"
                    : "text-muted hover:bg-fg/10 hover:text-fg",
                )}
              >
                <button
                  type="button"
                  className="max-w-40 truncate"
                  title={tabDoc.title}
                  onClick={() => openDoc(id)}
                >
                  {tabDoc.title}
                </button>
                <button
                  type="button"
                  aria-label={`Close ${tabDoc.title}`}
                  className={cn(
                    "flex size-5 items-center justify-center rounded-sm hover:bg-fg/10",
                    active ? "opacity-70" : "opacity-0 group-hover:opacity-70",
                  )}
                  onClick={() => closeTab(id)}
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
        {/* Collapses the icon rail only — an open sidebar panel stays put.
            Styled as a 4th native caption button: 45×34 box starting 1px from
            the top edge, square, and the same hover/press overlay Electron
            paints on min/max (black at 34/255 → #dddddd on white; pressed
            66/255 → #bdbdbd). */}
        <button
          type="button"
          title={railOpen ? "收起侧边栏" : "展开侧边栏"}
          aria-label={railOpen ? "收起侧边栏" : "展开侧边栏"}
          className="mt-px flex h-[34px] w-[45px] shrink-0 self-start items-center justify-center [-webkit-app-region:no-drag] hover:bg-black/[13.3%] active:bg-black/[25.9%]"
          onClick={() => setRailOpen(!railOpen)}
        >
          {railOpen ? (
            <PanelRightClose className="size-4" strokeWidth={1.7} />
          ) : (
            <PanelRightOpen className="size-4" strokeWidth={1.7} />
          )}
        </button>
      </header>

      {importProgress ? (
        <div className="border-b border-border bg-black/[13.3%] px-3 py-1.5 font-mono text-[11px] text-muted">
          {importProgress}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1">
          <PanelGroup orientation="horizontal" className="h-full" key={`${sidebarOpen}`}>
            <Panel defaultSize="80" minSize="30" className="min-w-0">
              <ReaderPane />
            </Panel>
            {sidebarOpen ? (
              <>
                <PanelResizeHandle className="w-px bg-border" />
                <Panel defaultSize="20" minSize="14" maxSize="32" className="min-w-0">
                  {sidebarView === "chat" ? <ChatPane /> : <SidebarPane />}
                </Panel>
              </>
            ) : null}
          </PanelGroup>
        </div>

        {railOpen ? (
          <div className="flex h-full">
            <ActivityRail />
          </div>
        ) : null}
      </div>
    </div>
  );
}
