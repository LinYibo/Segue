import { useEffect, useRef } from "react";
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from "react-resizable-panels";
import { PanelLeftOpen } from "lucide-react";
import { ActivityRail, SidebarPane } from "@/components/sidebar-pane";
import { ChatPane } from "@/components/chat-pane";
import { useSegue } from "@/lib/store";
import { useViewShortcuts } from "@/lib/use-view-shortcuts";
import { ReaderPane } from "./reader-pane";

/**
 * The app shell: a single document at a time (importing replaces it), the
 * activity rail on the left edge, and the browser's native scrollbars in the
 * reader. There is no in-app title bar — the browser tab's title carries the
 * open document's name instead.
 */
export function Workbench() {
  const boot = useSegue((s) => s.boot);
  const importFiles = useSegue((s) => s.importFiles);
  const importProgress = useSegue((s) => s.importProgress);
  const sidebarOpen = useSegue((s) => s.sidebarOpen);
  const railOpen = useSegue((s) => s.railOpen);
  const setRailOpen = useSegue((s) => s.setRailOpen);
  const sidebarView = useSegue((s) => s.sidebarView);
  const docTitle = useSegue((s) => s.docs.find((d) => d.id === s.activeDocId)?.title);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void boot();
  }, [boot]);

  // The open document's name (file name minus extension) replaces the old
  // document tab strip's label.
  useEffect(() => {
    document.title = docTitle ? `${docTitle} — Segue` : "Segue";
  }, [docTitle]);

  useViewShortcuts();

  return (
    <div
      ref={dropRef}
      className="relative flex h-dvh min-h-0 flex-col bg-bg text-fg"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (e.dataTransfer.files.length) void importFiles(e.dataTransfer.files);
      }}
    >
      {importProgress ? (
        <div className="border-b border-border bg-black/[13.3%] px-3 py-1.5 font-mono text-[11px] text-muted">
          {importProgress}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        {railOpen ? (
          <div className="flex h-full">
            <ActivityRail />
          </div>
        ) : (
          // Rail collapsed: its expand control floats at the bottom-left,
          // mirroring the collapse button at the rail's bottom.
          <button
            type="button"
            title="展开侧边栏"
            aria-label="展开侧边栏"
            className="absolute bottom-1 left-1 z-10 flex size-8 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-fg/10 hover:text-fg"
            onClick={() => setRailOpen(true)}
          >
            <PanelLeftOpen className="size-4" strokeWidth={1.7} />
          </button>
        )}

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
            <ReaderPane />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
