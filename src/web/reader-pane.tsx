import { useRef } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FoliateReader } from "@/components/foliate-reader";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useSegue } from "@/lib/store";

/**
 * The web reader pane: like the desktop's, but without the overlay scrollbar
 * — the foliate scrollers keep their native scrollbars (styles.css gates the
 * desktop's hiding rules on the platform attribute), so there is no thumb,
 * no metrics channel, and no edge-zone sensing.
 */
export function WebReaderPane() {
  const ready = useSegue((s) => s.ready);
  const docs = useSegue((s) => s.docs);
  const activeDocId = useSegue((s) => s.activeDocId);
  const locator = useSegue((s) => s.activeLocator);
  const file = useSegue((s) => (activeDocId ? s.fileCache[activeDocId] : undefined));
  const docLoadingId = useSegue((s) => s.docLoadingId);
  const importFiles = useSegue((s) => s.importFiles);
  const doc = docs.find((d) => d.id === activeDocId);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <p className="text-sm text-ink-muted">Opening library…</p>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
        <p className="font-serif text-xl text-ink">Open a PDF or EPUB file</p>
        <p className="max-w-sm text-sm leading-6 text-ink-muted">
          Drop one file on this page — it is parsed, chunked, and indexed right in your browser.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.epub,application/pdf,application/epub+zip"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void importFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <FolderOpen className="size-3.5" />
          Choose a file
        </Button>
      </div>
    );
  }

  // Drop is handled once, on the Workbench root — a handler here would bubble
  // and import the same file twice.
  return (
    <div className="relative h-full min-h-0 bg-bg">
      <div className="reader-scroll h-full overflow-y-auto">
        {file && (
          <FoliateReader key={`${doc.id}:${doc.kind}`} data={file} locator={locator} kind={doc.kind} />
        )}
        {docLoadingId === activeDocId && !file && (
          <p className="py-16 text-center text-sm text-ink-muted">Opening {doc.title}…</p>
        )}
      </div>
      <SelectionToolbar />
    </div>
  );
}
