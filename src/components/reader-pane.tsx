import { useEffect, useRef } from "react";
import { FoliateReader } from "@/components/foliate-reader";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useSegue } from "@/lib/store";

export function ReaderPane() {
  const ready = useSegue((s) => s.ready);
  const docs = useSegue((s) => s.docs);
  const activeDocId = useSegue((s) => s.activeDocId);
  const locator = useSegue((s) => s.activeLocator);
  const file = useSegue((s) => (activeDocId ? s.fileCache[activeDocId] : undefined));
  const docLoadingId = useSegue((s) => s.docLoadingId);
  const doc = docs.find((d) => d.id === activeDocId);

  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const fadeTimer = useRef(0);

  useEffect(() => () => window.clearTimeout(fadeTimer.current), []);

  // Overlay scroll indicator: shows position while scrolling, fades when idle.
  // Fed by the pane's own scroller and, in scrolled flow, by the internal
  // scroller of the foliate renderers relayed through "segue-reader-scroll".
  const updateThumb = (scrollTop: number, scrollHeight: number, clientHeight: number) => {
    const thumb = thumbRef.current;
    if (!thumb) return;
    if (scrollHeight <= clientHeight) return;
    const h = Math.max(40, Math.round((clientHeight / scrollHeight) * clientHeight));
    const y = Math.round((scrollTop / (scrollHeight - clientHeight)) * (clientHeight - h));
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translateY(${y}px)`;
    thumb.style.opacity = "1";
    window.clearTimeout(fadeTimer.current);
    fadeTimer.current = window.setTimeout(() => {
      if (thumbRef.current) thumbRef.current.style.opacity = "0";
    }, 700);
  };

  const onScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    updateThumb(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight);
  };

  useEffect(() => {
    const onReaderScroll = (e: Event) => {
      const d = (e as CustomEvent).detail as
        | { scrollTop: number; scrollHeight: number; clientHeight: number }
        | undefined;
      if (d) updateThumb(d.scrollTop, d.scrollHeight, d.clientHeight);
    };
    window.addEventListener("segue-reader-scroll", onReaderScroll);
    return () => {
      window.removeEventListener("segue-reader-scroll", onReaderScroll);
      window.clearTimeout(fadeTimer.current);
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <p className="text-sm text-ink-muted">Opening library…</p>
      </div>
    );
  }

  // Drop is handled once, on the Workbench root — a handler here would bubble
  // and import the same file twice.
  if (!doc) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <p className="font-serif text-xl text-ink">Drop a PDF or EPUB file</p>
        <p className="max-w-sm text-sm text-ink-muted">
          Segue will parse, chunk, and index it on this device.
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-bg">
      <div
        ref={scrollRef}
        className="reader-scroll relative min-h-0 flex-1 overflow-y-auto"
        onScroll={onScroll}
      >
        {/* Sticky zero-height wrapper keeps the thumb fixed in the pane while
            the content scrolls under it; no layout width is reserved. */}
        <div aria-hidden className="pointer-events-none sticky top-0 z-10 h-0">
          <div
            ref={thumbRef}
            className="absolute top-0 right-px w-1 rounded-full bg-fg/20 opacity-0 transition-opacity duration-300"
          />
        </div>
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
