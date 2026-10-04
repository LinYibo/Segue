import { useEffect, useRef, useState } from "react";
import { Overlayer } from "@/foliate-js/overlayer.js";
import "@/foliate-js/view.js";
import type { FoliateView, RelocateDetail } from "@/foliate-js/view.js";
import {
  applyFixedlayoutStyles,
  applyImageStyle,
  applyNamespacedAttributes,
  applyScrollModeClass,
  applyThemeModeClass,
  getDirection,
  getPageProgressionRTL,
  isCJKEnv,
  getStyles,
  isCJKLang,
  keepTextAlignment,
  makeEpubViewSettings,
  mountBookFonts,
  transformInlineStyles,
  transformStylesheet,
  type EpubViewSettings,
} from "@/lib/epub/readest";
import { dropBook, getBook } from "@/lib/parse/foliate";
import { useSegue } from "@/lib/store";
import type { DocKind } from "@/lib/types";
import { createWheelGestureDetector } from "@/lib/wheel-gesture";

// Ported from readest's reader (FoliateViewer.tsx + usePagination.ts +
// iframeEventHandlers.ts + wheelGesture.ts, desktop subset): the same
// open-sequence attributes for both renderers (foliate-paginator for EPUB,
// foliate-fxl for PDF), injected stylesheet, iframe event relay with click
// zones, double-click protection and wheel-gesture coalescing, and
// rAF-coalesced relocation. Shell glue (locator sync, CFI highlights,
// selection capture) stays Segue's.

const DOUBLE_CLICK_INTERVAL_THRESHOLD_MS = 250;
const LONG_HOLD_THRESHOLD = 500;

// usePagination.ts viewPagination (Segue subset): in scrolled flow a turn is
// one viewport scroll (scrollingOverlap = 0); RTL books flip left/right.
const viewPagination = (
  view: FoliateView | null,
  settings: EpubViewSettings,
  side: "left" | "right" | "up" | "down",
) => {
  if (!view) return;
  if (settings.rtl) {
    if (side === "left") side = "right";
    else if (side === "right") side = "left";
  }
  if (view.renderer.scrolled) {
    const distance = view.renderer.size;
    void (side === "left" || side === "up" ? view.prev(distance) : view.next(distance));
    return;
  }
  void (side === "left" || side === "up" ? view.prev() : view.next());
};

export function FoliateReader({
  data,
  locator,
  kind,
}: {
  data: ArrayBuffer;
  locator: string;
  kind: DocKind;
}) {
  const root = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FoliateView | null>(null);
  const settingsRef = useRef<EpubViewSettings | null>(null);
  const initedRef = useRef(false);
  // last locator this reader reported from a relocate — the jump effect must
  // not re-scroll to our own reports
  const lastReportedRef = useRef("");
  const [failed, setFailed] = useState(false);
  const setLocator = useSegue((s) => s.setLocator);
  const setSelection = useSegue((s) => s.setSelection);
  const importFiles = useSegue((s) => s.importFiles);

  // Coalesced relocation (FoliateViewer.tsx progressRelocateHandler): foliate
  // fires several relocates per gesture; only the last one in a frame matters.
  const pendingRelocate = useRef<RelocateDetail | null>(null);
  const relocateRaf = useRef<number | null>(null);
  const relocateTimer = useRef(0);
  const commitRelocate = useRef(() => {});
  commitRelocate.current = () => {
    if (relocateRaf.current != null) {
      cancelAnimationFrame(relocateRaf.current);
      relocateRaf.current = null;
    }
    window.clearTimeout(relocateTimer.current);
    const detail = pendingRelocate.current;
    pendingRelocate.current = null;
    if (!detail?.cfi) return;
    const state = useSegue.getState();
    const current = detail.section?.current ?? -1;
    const sec = state.sections[state.activeDocId ?? ""]?.[current];
    // PDF pages report as the readable p.N; everything else keeps the
    // precise CFI.
    const locator = kind === "pdf" ? `p.${current + 1}` : detail.cfi;
    lastReportedRef.current = locator;
    setLocator(locator, sec?.text.slice(0, 1500) ?? "");
  };

  useEffect(() => {
    let cancelled = false;
    let view: FoliateView | null = null;
    let dropRelayObserver: MutationObserver | null = null;
    lastReportedRef.current = "";
    initedRef.current = false;
    setFailed(false);

    const onRelocate = (e: Event) => {
      const detail = (e as CustomEvent<RelocateDetail>).detail;
      if (!detail?.location) return;
      pendingRelocate.current = detail;
      if (relocateRaf.current == null) {
        relocateRaf.current = requestAnimationFrame(() => commitRelocate.current());
      }
      window.clearTimeout(relocateTimer.current);
      relocateTimer.current = window.setTimeout(() => commitRelocate.current(), 100);
    };

    const onDrawAnnotation = (e: Event) => {
      const { draw } = (e as CustomEvent).detail;
      draw(Overlayer.highlight, { color: "#ffff00" });
    };

    // foliate's default for external links is window.open — the desktop shell
    // must route them through the browser instead.
    const onExternalLink = (e: Event) => {
      e.preventDefault();
      const href = (e as CustomEvent<{ a: HTMLAnchorElement; href: string }>).detail?.href;
      if (href) void window.electronAPI.openExternal(href);
    };

    // The view keeps no annotation registry: each section render requires the
    // host to re-add the highlights that live in it.
    const onCreateOverlay = (e: Event) => {
      const v = viewRef.current;
      if (!v) return;
      const { index } = (e as CustomEvent<{ index: number }>).detail;
      const state = useSegue.getState();
      const docId = state.activeDocId;
      if (!docId) return;
      for (const h of state.highlights) {
        if (h.docId !== docId || !h.cfi) continue;
        try {
          if (v.resolveCFI(h.cfi).index === index) void v.addAnnotation({ value: h.cfi });
        } catch {
          // unresolvable CFI: not in this section, skip
        }
      }
    };

    // -------------------------------------------------------------------
    // iframe event relay (iframeEventHandlers.ts + usePagination.ts
    // handlePageFlip, desktop subset — no touch/autoscroll/word-lens).
    // Events from inside the book iframe can't reach the shell, so handlers
    // on the section document postMessage to the window, where one message
    // listener routes them into the pagination funnel.
    // -------------------------------------------------------------------
    let isMouseDown = false;
    let lastClickTime = 0;
    let longHoldTimeout = 0;
    let singleClickTimer = 0;
    const doubleClickDisabled = false;
    // wheelGesture.ts: one physical wheel gesture flips one page, its
    // momentum tail is swallowed until the wheel goes idle.
    const wheelDetector = createWheelGestureDetector();

    const postSingleClick = (event: MouseEvent) => {
      const element = event.target as HTMLElement | null;
      // links/notes/media are foliate's or the shell's business, never a
      // page turn (readest handleClick's guard, minus its media viewer)
      if (element?.closest("sup, a, audio, video")) return;
      // a drag (e.g. double-click-and-drag selection) or a long hold is not
      // a single click (#4524)
      if (isMouseDown) return;
      if (!longHoldTimeout) return;
      window.postMessage(
        {
          type: "iframe-single-click",
          screenX: event.screenX,
          clientX: event.clientX,
          clientY: event.clientY,
        },
        "*",
      );
    };

    const relayClick = (event: MouseEvent) => {
      const now = Date.now();
      if (!doubleClickDisabled && now - lastClickTime < DOUBLE_CLICK_INTERVAL_THRESHOLD_MS) {
        lastClickTime = now;
        // second click of a double-click: swallow both (no viewer to open)
        window.clearTimeout(singleClickTimer);
        return;
      }
      lastClickTime = now;
      window.clearTimeout(singleClickTimer);
      singleClickTimer = window.setTimeout(() => {
        if (Date.now() - lastClickTime >= DOUBLE_CLICK_INTERVAL_THRESHOLD_MS) {
          postSingleClick(event);
        }
      }, DOUBLE_CLICK_INTERVAL_THRESHOLD_MS);
    };

    const relayMousedown = (event: MouseEvent) => {
      isMouseDown = true;
      longHoldTimeout = window.setTimeout(() => {
        longHoldTimeout = 0;
      }, LONG_HOLD_THRESHOLD);
      if (event.button === 3 || event.button === 4) event.preventDefault();
    };
    const relayMouseup = (event: MouseEvent) => {
      isMouseDown = false;
      if (event.button === 3 || event.button === 4) {
        event.preventDefault();
        window.postMessage({ type: "iframe-mouseup", button: event.button }, "*");
      }
    };
    const relayAuxclick = (event: MouseEvent) => {
      if (event.button === 3 || event.button === 4) event.preventDefault();
    };
    const relayWheel = (event: WheelEvent) => {
      window.postMessage(
        {
          type: "iframe-wheel",
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaMode: event.deltaMode,
          ctrlKey: event.ctrlKey,
        },
        "*",
      );
    };

    const relayKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName ?? "") ||
        (/^(A|BUTTON)$/.test(target?.tagName ?? "") && (event.key === "Enter" || event.key === " "))
      ) {
        return;
      }
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", " "].includes(
          event.key,
        ) &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey
      ) {
        event.preventDefault();
        window.postMessage({ type: "iframe-keydown", key: event.key }, "*");
      }
    };

    // A file dropped over the book lands inside the section iframe and never
    // reaches the shell root's drop handler — import right here, which opens
    // the file in a new active tab like a drop anywhere else. dragover must
    // preventDefault or Chromium never fires drop; text drags inside the book
    // stay untouched.
    const relayDragover = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const relayDrop = (event: DragEvent) => {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      void importFiles(event.dataTransfer.files);
    };

    const onMessage = (msg: MessageEvent) => {
      const d = msg.data;
      if (!d?.type) return;
      const viewSettings = settingsRef.current;
      const v = viewRef.current;
      if (!v || !viewSettings || !initedRef.current) return;
      if (d.type === "iframe-single-click") {
        // click zones: the outer 62.5% turns, the middle band does nothing
        // (readest toggles its chrome there; Segue has none)
        const rect = root.current?.getBoundingClientRect();
        if (!rect) return;
        const viewStartX = window.screenX + rect.left;
        const viewCenterX = viewStartX + rect.width / 2;
        const centerStartX = viewStartX + rect.width * 0.375;
        const centerEndX = viewStartX + rect.width * 0.625;
        const screenX = d.screenX as number;
        if (screenX >= centerStartX && screenX <= centerEndX) return;
        const side = screenX >= viewCenterX ? "right" : "left";
        viewPagination(v, viewSettings, side);
      } else if (d.type === "iframe-wheel" && !viewSettings.scrolled) {
        const deltaY = d.deltaY as number;
        const deltaX = d.deltaX as number;
        if (d.ctrlKey) {
          // Pinch/ctrl-wheel zoom is not a page-turn gesture (readest wires
          // it to its zoom controls; Segue has none — drop it either way).
          wheelDetector.reset();
          return;
        }
        // every gesture past the intent threshold is one turn attempt
        const flip = wheelDetector.feed({
          deltaX,
          deltaY,
          deltaMode: (d.deltaMode as number) ?? 0,
          timeStamp: msg.timeStamp || performance.now(),
        });
        if (!flip) return;
        if (flip.deltaY > 0) viewPagination(v, viewSettings, "down");
        else if (flip.deltaY < 0) viewPagination(v, viewSettings, "up");
        else if (flip.deltaX < 0) viewPagination(v, viewSettings, "left");
        else if (flip.deltaX > 0) viewPagination(v, viewSettings, "right");
      } else if (d.type === "iframe-mouseup") {
        if (d.button === 3) void v.history.back();
        else if (d.button === 4) void v.history.forward();
      } else if (d.type === "iframe-keydown") {
        const key = d.key as string;
        if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(key)) {
          viewPagination(v, viewSettings, "down");
        } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(key)) {
          viewPagination(v, viewSettings, "up");
        }
      }
    };
    window.addEventListener("message", onMessage);

    // Page turns from the keyboard while focus is outside the book iframe.
    const onWindowKeydown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        !viewRef.current ||
        !settingsRef.current ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        (target &&
          (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
      ) {
        return;
      }
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        viewPagination(viewRef.current, settingsRef.current, "down");
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        viewPagination(viewRef.current, settingsRef.current, "up");
      }
    };
    window.addEventListener("keydown", onWindowKeydown);

    // The scrolled flow scrolls inside the foliate renderers, not the pane.
    // Relay those scrolls outward (bubbling CustomEvent) so the pane's
    // position indicator keeps working. Capture phase: scroll doesn't bubble,
    // the fxl strip scrolls on its own host element, and the paginator's
    // container sits one shadow root deeper.
    const reportScroll = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el || typeof el.scrollTop !== "number") return;
      root.current?.dispatchEvent(
        new CustomEvent("segue-reader-scroll", {
          bubbles: true,
          composed: true,
          detail: {
            scrollTop: el.scrollTop,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
          },
        }),
      );
    };

    // FoliateViewer.tsx docLoadHandler: per-section DOM fixups, then the
    // relay listeners (once per document).
    const onLoad = (e: Event) => {
      const { doc: sectionDoc } = (e as CustomEvent<{ doc: Document; index: number }>).detail;
      const v = viewRef.current;
      const settings = settingsRef.current;
      if (!v || !settings || !sectionDoc) return;
      const fixed = v.book.rendition?.layout === "pre-paginated";

      applyNamespacedAttributes(sectionDoc);

      // A vertical section flips the measure and the reading direction.
      const writingDir = getDirection(sectionDoc);
      const newRtl = getPageProgressionRTL("auto", v.book.dir, writingDir.rtl);
      if (settings.vertical !== writingDir.vertical || settings.rtl !== newRtl) {
        settings.vertical = writingDir.vertical;
        settings.rtl = newRtl;
        v.renderer.setStyles?.(getStyles(settings));
        v.renderer.setAttribute(
          "max-inline-size",
          `${settings.vertical ? Math.max(window.innerWidth, window.innerHeight, 720) : settings.maxInlineSize}px`,
        );
      }

      if (!fixed) mountBookFonts(sectionDoc, isCJKLang(langOf(v.book)) || isCJKEnv());
      if (fixed) applyFixedlayoutStyles(sectionDoc, kind === "pdf" ? "PDF" : "EPUB");
      applyImageStyle(sectionDoc);
      applyThemeModeClass(sectionDoc);
      applyScrollModeClass(sectionDoc, settings.scrolled);
      keepTextAlignment(sectionDoc);

      // Selection capture (Segue shell): the toolbar lives below the reader,
      // so only text + CFI + section locator are needed.
      sectionDoc.addEventListener("pointerup", () => {
        const sel = sectionDoc.defaultView?.getSelection();
        const text = sel?.toString().trim() ?? "";
        if (!sel || sel.isCollapsed || !sel.rangeCount || text.length < 2) {
          if (sel?.isCollapsed) setSelection(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const secIndex = v.renderer.getContents().find((c) => c.doc === sectionDoc)?.index;
        if (secIndex === undefined) return;
        const cfi = v.getCFI(secIndex, range);
        const state = useSegue.getState();
        const sec = state.sections[state.activeDocId ?? ""]?.[secIndex];
        setSelection({
          text: text.slice(0, 2000),
          locator: sec?.locator ?? "",
          cfi,
        });
      });

      const flagged = sectionDoc as Document & { isEventListenersAdded?: boolean };
      if (!flagged.isEventListenersAdded) {
        flagged.isEventListenersAdded = true;
        sectionDoc.addEventListener("mousedown", relayMousedown);
        sectionDoc.addEventListener("mouseup", relayMouseup);
        sectionDoc.addEventListener("auxclick", relayAuxclick);
        sectionDoc.addEventListener("click", relayClick);
        sectionDoc.addEventListener("wheel", relayWheel, { passive: true });
        sectionDoc.addEventListener("keydown", relayKeydown);
        sectionDoc.addEventListener("dragover", relayDragover);
        sectionDoc.addEventListener("drop", relayDrop);
      }
    };

    void (async () => {
      try {
        const book = await getBook(data, kind === "pdf" ? "book.pdf" : undefined);
        if (cancelled) return;
        const settings = makeEpubViewSettings(isCJKEnv());
        settingsRef.current = settings;

        view = document.createElement("foliate-view") as FoliateView;
        viewRef.current = view;
        Object.assign(view.style, { width: "100%", height: "100%", display: "block" });
        // The fixed-layout strip scrolls on its own host element inside the
        // view's shadow tree — it has no exported part, so hide its scrollbar
        // with a rule injected into that tree (styles.css covers the paginator
        // via foliate-view::part(container)).
        const scrollbarStyle = document.createElement("style");
        scrollbarStyle.textContent = "foliate-fxl { scrollbar-width: none; }";
        view.shadowRoot?.appendChild(scrollbarStyle);
        view.addEventListener("relocate", onRelocate);
        view.addEventListener("draw-annotation", onDrawAnnotation);
        view.addEventListener("external-link", onExternalLink);
        view.addEventListener("create-overlay", onCreateOverlay);
        view.addEventListener("load", onLoad);
        root.current?.appendChild(view);

        // Fixed-layout open extras (FoliateViewer.tsx): two-page spreads with
        // the cover keeping its natural spread.
        const rendition = book.rendition;
        const fixed = rendition?.layout === "pre-paginated";
        if (rendition && fixed) {
          rendition.spread = "auto";
          const cover = book.sections[0];
          if (cover && cover.pageSpread !== "center") cover.pageSpread = "";
        }

        await view.open(book);
        if (cancelled) return;
        view.shadowRoot?.addEventListener("scroll", reportScroll, true);
        view.renderer.shadowRoot?.addEventListener("scroll", reportScroll, true);

        // Arm the drop relays on every section document as its iframe appears.
        // The scrolled-flow paginator loads sections into lazily created
        // iframes without the view-level 'load' event ever reaching the shell,
        // so the onLoad attachment above can't be relied on for EPUB;
        // addEventListener dedupes identical handlers for docs that got there.
        const armedDocs = new WeakSet<Document>();
        const armDropRelay = (iframe: HTMLIFrameElement) => {
          const arm = () => {
            const doc = iframe.contentDocument;
            if (!doc || armedDocs.has(doc)) return;
            armedDocs.add(doc);
            doc.addEventListener("dragover", relayDragover);
            doc.addEventListener("drop", relayDrop);
          };
          iframe.addEventListener("load", arm);
          arm();
        };
        dropRelayObserver = new MutationObserver((muts) => {
          for (const mut of muts)
            for (const node of mut.addedNodes) {
              const el = node as Element;
              if (el.tagName === "IFRAME") armDropRelay(el as HTMLIFrameElement);
            }
        });
        const rendererShadow = view.renderer.shadowRoot;
        if (rendererShadow) {
          dropRelayObserver.observe(rendererShadow, { childList: true, subtree: true });
          rendererShadow
            .querySelectorAll("iframe")
            .forEach((f) => armDropRelay(f as HTMLIFrameElement));
        }

        // Book-CSS rewriter (getDocTransformHandler, CSS branch only): book
        // stylesheets pass through transformStylesheet so vw/vh, media
        // queries and page-break hacks resolve against the reader viewport.
        // PDF books have no transformTarget — their pages are app-rendered.
        book.transformTarget?.addEventListener("data", (event: Event) => {
          const detail = (event as CustomEvent<{ type: string; data: unknown }>).detail;
          const isCss = detail.type === "text/css";
          const isHtml = detail.type === "application/xhtml+xml" || detail.type === "text/html";
          if (!isCss && !isHtml) return;
          detail.data = Promise.resolve(detail.data).then((data) =>
            isCss
              ? transformStylesheet(
                  String(data),
                  window.innerWidth,
                  window.innerHeight,
                  settings.vertical,
                  false,
                )
              : transformInlineStyles(
                  String(data),
                  window.innerWidth,
                  window.innerHeight,
                  settings.vertical,
                ),
          );
        });

        // FoliateViewer.tsx openBook + applyMarginAndGap, scrolled flow (Segue
        // reads in single-page scroll mode): EPUB is one continuous column,
        // PDF a vertical strip of single pages fitted to the width. The fixed
        // zoom/spread knobs are inert in the strip; they stay so a future
        // paginated flow opens with readest's desktop defaults.
        view.renderer.setStyles?.(getStyles(settings));
        view.toggleAttribute("autohide-cursor", true);
        view.renderer.setAttribute("flow", "scrolled");
        view.renderer.setAttribute("scroll-direction", "vertical");
        if (fixed) {
          view.renderer.setAttribute("zoom", "fit-page");
          view.renderer.setAttribute("spread", "auto");
          view.renderer.setAttribute("scale-factor", "100");
          // getScrollGapAttr(viewSettings.webtoonMode=false) === "4"
          view.renderer.setAttribute("scroll-gap", "4");
        } else {
          view.renderer.setAttribute("max-column-count", String(settings.maxColumnCount));
          view.renderer.setAttribute("max-inline-size", `${settings.maxInlineSize}px`);
          view.renderer.setAttribute("max-block-size", `${settings.maxBlockSize}px`);
        }
        view.renderer.setAttribute("margin-top", `${settings.marginTopPx}px`);
        view.renderer.setAttribute("margin-right", `${settings.marginRightPx}px`);
        view.renderer.setAttribute("margin-bottom", `${settings.marginBottomPx}px`);
        view.renderer.setAttribute("margin-left", `${settings.marginLeftPx}px`);
        view.renderer.setAttribute("gap", `${settings.gapPercent}%`);

        initedRef.current = true;
        const initLoc = initLocation(locator, kind);
        if (cancelled) return;
        if (initLoc !== undefined) await view.init({ lastLocation: initLoc });
        else await view.goToFraction(0);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onWindowKeydown);
      dropRelayObserver?.disconnect();
      window.clearTimeout(singleClickTimer);
      window.clearTimeout(relocateTimer.current);
      if (relocateRaf.current != null) cancelAnimationFrame(relocateRaf.current);
      if (view) {
        view.shadowRoot?.removeEventListener("scroll", reportScroll, true);
        view.renderer.shadowRoot?.removeEventListener("scroll", reportScroll, true);
        view.close();
        view.remove();
      }
      viewRef.current = null;
      settingsRef.current = null;
      // A PDF book holds a pdf.js worker that survives GC; release it with
      // the cache slot so a later open re-parses instead of resurrecting it.
      dropBook(data);
    };
    // locator intentionally excluded: jumps are handled by the effect below,
    // the initial locator is consumed through initLocation at open time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Follow external locator jumps (TOC / highlights / agent / restore). CFI
  // locators go to the view directly; ch.N ones resolve to the section href,
  // with fragment precision riding along; p.N (PDF) resolves by page index.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !locator || locator === lastReportedRef.current) return;
    lastReportedRef.current = locator;
    if (locator.startsWith("epubcfi")) {
      void view.goTo(locator);
      return;
    }
    const m = /^p\.(\d+)$/.exec(locator);
    if (m) {
      void view.goTo(Number(m[1]) - 1);
      return;
    }
    const ch = /^ch\.(\d+)/.exec(locator);
    const state = useSegue.getState();
    const secs = state.sections[state.activeDocId ?? ""] ?? [];
    const sec = ch ? secs[Number(ch[1]) - 1] : undefined;
    if (sec?.src) {
      const frag = locator.includes("#") ? `#${locator.slice(locator.indexOf("#") + 1)}` : "";
      void view.goTo(`${sec.src}${frag}`);
      return;
    }
    void view.goTo(locator); // raw href passthrough
  }, [locator]);

  // Keep the overlay layer in sync with stored highlights (sidebar Remove,
  // agent add_highlight while the section is already rendered).
  const highlights = useSegue((s) => s.highlights);
  const activeDocId = useSegue((s) => s.activeDocId);
  const hlRef = useRef(new Map<string, string>());
  useEffect(() => {
    const mine = new Map(
      highlights.filter((h) => h.docId === activeDocId && h.cfi).map((h) => [h.id, h.cfi!]),
    );
    const prev = hlRef.current;
    hlRef.current = mine;
    const view = viewRef.current;
    if (!view) return;
    for (const [id, cfi] of prev) if (!mine.has(id)) void view.addAnnotation({ value: cfi }, true);
    for (const [id, cfi] of mine) if (prev.get(id) !== cfi) void view.addAnnotation({ value: cfi });
  }, [highlights, activeDocId]);

  return (
    <div ref={root} className="relative h-full w-full">
      {failed ? <p className="p-8 text-sm text-ink-muted">Failed to open this document.</p> : null}
    </div>
  );
}

// ch.N:slug#frag → the section's href with fragment; CFI locators pass
// through; p.N (PDF) resolves by page index; anything else (raw hrefs) is
// left for the view to resolve.
// metadata values may be plain strings or language maps ({en: "…"})
function langOf(book: { metadata?: Record<string, unknown> }): string | null {
  const value = book.metadata?.language;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return langOf({ metadata: { language: value[0] } });
  if (value && typeof value === "object") {
    const first = Object.values(value).find((v) => typeof v === "string");
    return typeof first === "string" ? first : null;
  }
  return null;
}

function initLocation(locator: string, kind: DocKind): string | number | undefined {
  if (!locator) return undefined;
  if (locator.startsWith("epubcfi")) return locator;
  const page = /^p\.(\d+)$/.exec(locator);
  if (page) return kind === "pdf" ? Number(page[1]) - 1 : undefined;
  const m = /^ch\.(\d+)/.exec(locator);
  if (!m) return undefined;
  const state = useSegue.getState();
  const sec = state.sections[state.activeDocId ?? ""]?.[Number(m[1]) - 1];
  if (!sec?.src) return undefined;
  const frag = locator.includes("#") ? `#${locator.slice(locator.indexOf("#") + 1)}` : "";
  return `${sec.src}${frag}`;
}
