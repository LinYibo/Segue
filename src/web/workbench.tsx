import { useEffect, useRef } from "react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ActivityRail, SidebarPane } from "@/components/sidebar-pane";
import { ChatPane } from "@/components/chat-pane";
import { useSegue } from "@/lib/store";
import { useViewShortcuts } from "@/lib/use-view-shortcuts";
import { WebReaderPane } from "./reader-pane";

/**
 * The web shell: a single document at a time (importing replaces it), the
 * activity rail on the left edge, and the browser's native scrollbars in the
 * reader — the desktop keeps its tab strip, right-edge rail, and overlay
 * scrollbar instead.
 */
export function WebWorkbench() {
  const boot = useSegue((s) => s.boot);
  const importFiles = useSegue((s) => s.importFiles);
  const importProgress = useSegue((s) => s.importProgress);
  const sidebarOpen = useSegue((s) => s.sidebarOpen);
  const railOpen = useSegue((s) => s.railOpen);
  const setRailOpen = useSegue((s) => s.setRailOpen);
  const sidebarView = useSegue((s) => s.sidebarView);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  useViewShortcuts();

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
      <header className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-bg px-1.5">
        <button
          type="button"
          title={railOpen ? "收起侧边栏" : "展开侧边栏"}
          aria-label={railOpen ? "收起侧边栏" : "展开侧边栏"}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-fg/10 hover:text-fg"
          onClick={() => setRailOpen(!railOpen)}
        >
          {railOpen ? (
            <PanelLeftClose className="size-4" strokeWidth={1.7} />
          ) : (
            <PanelLeftOpen className="size-4" strokeWidth={1.7} />
          )}
        </button>
        <span className="flex items-center pl-1 text-sm font-medium tracking-tight">Segue</span>
      </header>

      {importProgress ? (
        <div className="border-b border-border bg-black/[13.3%] px-3 py-1.5 font-mono text-[11px] text-muted">
          {importProgress}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {railOpen ? (
          <div className="flex h-full">
            <ActivityRail side="left" />
          </div>
        ) : null}

        {/* Sidebar panel hugs the rail on the left, reader takes the rest. */}
        <PanelGroup orientation="horizontal" className="h-full" key={`${sidebarOpen}`}>
          {sidebarOpen ? (
            <>
              <Panel defaultSize="20" minSize="14" maxSize="32" className="min-w-0">
                {sidebarView === "chat" ? <ChatPane /> : <SidebarPane />}
              </Panel>
              <PanelResizeHandle className="w-px bg-border" />
            </>
          ) : null}
          <Panel defaultSize="80" minSize="30" className="min-w-0">
            <WebReaderPane />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
