import { useCallback, useEffect, useRef, useState } from "react";
import { FoliateReader } from "@/components/foliate-reader";
import { SelectionToolbar } from "@/components/selection-toolbar";
import { useSegue } from "@/lib/store";
import { cn } from "@/lib/utils";

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
  const dragRef = useRef(false);
  // Last reported thumb state, all fraction-based (0..1 of the whole book for
  // reflowable content, of the pixel range for fixed layout — reported by the
  // reader): pos drives the thumb's position, client/h the drag math, live
  // picks the drag style (per-move seeks vs scrub-then-seek).
  const metrics = useRef({ pos: 0, client: 0, h: 0, live: false });
  const dragStart = useRef({ y: 0, pos: 0 });
  const dragFraction = useRef<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Thumb visibility is derived state, never imperative style writes: shown
  // while the scroller reports activity (auto-fades), while the pointer
  // hovers the thumb or the right-edge strip, or while dragging — and only
  // when there is something to scroll. Derived per render, so no flag can
  // get stuck and suppress a reveal; the opacity/pointer-events classes are
  // React's single source of truth.
  const [scrollable, setScrollable] = useState(false);
  const [scrollActive, setScrollActive] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [inZone, setInZone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const shown = scrollable && (scrollActive || hovering || inZone || dragging);

  useEffect(() => () => window.clearTimeout(fadeTimer.current), []);

  const updateThumb = useCallback(
    (
      scrollTop: number,
      scrollHeight: number,
      clientHeight: number,
      fraction?: number,
      live?: boolean,
    ) => {
      if (scrollHeight <= clientHeight) {
        setScrollable(false);
        return;
      }
      setScrollable(true);
      const pos =
        typeof fraction === "number"
          ? Math.min(1, Math.max(0, fraction))
          : scrollTop / (scrollHeight - clientHeight);
      const h = Math.max(40, Math.round((clientHeight / scrollHeight) * clientHeight));
      metrics.current = { pos, client: clientHeight, h, live: live ?? false };
      // While the thumb is dragged it is owned by the pointer — reports only
      // refresh the metrics; repositioning resumes on release.
      if (!dragRef.current) {
        const thumb = thumbRef.current;
        if (thumb) {
          thumb.style.height = `${h}px`;
          thumb.style.transform = `translateY(${Math.round(pos * (clientHeight - h))}px)`;
        }
      }
      setScrollActive(true);
      window.clearTimeout(fadeTimer.current);
      fadeTimer.current = window.setTimeout(() => setScrollActive(false), 700);
    },
    [],
  );

  const onScroll = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    updateThumb(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight);
  };

  // Approaching the right edge behaves like hovering a native scrollbar: the
  // thumb shows and stays grabbable. The reader senses the strip from both
  // surfaces (book iframes swallow parent-document pointer events) and
  // reports boundary crossings via "segue-reader-zone"; leaving the pane
  // entirely clears it here.
  useEffect(() => {
    const onZone = (e: Event) => {
      const d = (e as CustomEvent).detail as { inZone?: boolean } | undefined;
      if (d) setInZone(Boolean(d.inZone));
    };
    window.addEventListener("segue-reader-zone", onZone);
    return () => window.removeEventListener("segue-reader-zone", onZone);
  }, []);

  // Drag style comes from the reader's `live` flag. Fixed layout: every move
  // seeks for real — its pixel range is stable and pages rasterize cheaply.
  // Reflowable content scrubs: foliate's scrolled engine loads sections on
  // the main thread and re-anchors while scrolling, so live-following a
  // dragged thumb janks and blinks; the thumb (and a percent preview) track
  // the pointer locally with zero engine work, and the one seek fires on
  // release — the same cost as a TOC jump.
  const showPreview = (fraction: number) => {
    const pill = previewRef.current;
    if (!pill) return;
    const { client, h } = metrics.current;
    pill.textContent = `${Math.round(fraction * 100)}%`;
    pill.style.transform = `translateY(${Math.round(fraction * (client - h) - pill.offsetHeight / 2)}px)`;
  };

  const onThumbPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = true;
    setDragging(true);
    dragStart.current = { y: e.clientY, pos: metrics.current.pos };
    dragFraction.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onThumbPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const { client, h, live } = metrics.current;
    if (client - h <= 0) return;
    const delta = e.clientY - dragStart.current.y;
    const target = Math.min(1, Math.max(0, dragStart.current.pos + delta / (client - h)));
    const thumb = thumbRef.current;
    if (thumb) {
      thumb.style.height = `${h}px`;
      thumb.style.transform = `translateY(${Math.round(target * (client - h))}px)`;
    }
    showPreview(target);
    if (live) {
      window.dispatchEvent(new CustomEvent("segue-reader-seek", { detail: { fraction: target } }));
    } else {
      dragFraction.current = target;
    }
  };
  const onThumbPointerEnd = () => {
    if (!dragRef.current) return;
    dragRef.current = false;
    setDragging(false);
    const f = dragFraction.current;
    dragFraction.current = null;
    if (typeof f === "number") {
      window.dispatchEvent(new CustomEvent("segue-reader-seek", { detail: { fraction: f } }));
    }
  };

  useEffect(() => {
    const onReaderScroll = (e: Event) => {
      const d = (e as CustomEvent).detail as
        | {
            scrollTop: number;
            scrollHeight: number;
            clientHeight: number;
            fraction?: number;
            live?: boolean;
          }
        | undefined;
      if (d) updateThumb(d.scrollTop, d.scrollHeight, d.clientHeight, d.fraction, d.live);
    };
    window.addEventListener("segue-reader-scroll", onReaderScroll);
    return () => {
      window.removeEventListener("segue-reader-scroll", onReaderScroll);
      window.clearTimeout(fadeTimer.current);
    };
  }, [updateThumb]);

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
        onPointerLeave={() => setInZone(false)}
      >
        {/* Sticky zero-height wrapper keeps the thumb fixed in the pane while
            the content scrolls under it; no layout width is reserved. The
            thumb's ::before extends its grab area to 16px wide without
            changing what is painted. The percent preview rides next to it
            during a drag. Visibility is class-driven — opacity-0 thumbs also
            drop pointer events, so an invisible one never swallows clicks on
            the book. */}
        <div aria-hidden className="pointer-events-none sticky top-0 z-10 h-0">
          <div
            ref={previewRef}
            className={cn(
              "absolute top-0 right-4 mr-1 rounded-md bg-fg px-1.5 py-0.5 font-mono text-[10px] leading-4 text-bg transition-opacity duration-150",
              dragging ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            ref={thumbRef}
            className={cn(
              "absolute top-0 right-px w-1 cursor-default rounded-full bg-fg/20 transition-opacity duration-300 before:absolute before:inset-y-0 before:-inset-x-2 before:content-[''] hover:bg-fg/40",
              shown ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
            )}
            onPointerDown={onThumbPointerDown}
            onPointerMove={onThumbPointerMove}
            onPointerUp={onThumbPointerEnd}
            onPointerCancel={onThumbPointerEnd}
            onPointerEnter={() => setHovering(true)}
            onPointerLeave={() => setHovering(false)}
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
