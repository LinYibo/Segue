import { useEffect, useRef, useState } from "react";
import { Overlayer } from "@/foliate-js/overlayer.js";
import { SectionProgress } from "@/foliate-js/progress.js";
import "@/foliate-js/view.js";
import type { FoliateView, RelocateDetail } from "@/foliate-js/view.js";
import {
  applyFixedlayoutStyles,
  applyImageStyle,
  applyNamespacedAttributes,
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
import { host } from "@/lib/platform";
import { useSegue } from "@/lib/store";
import type { DocKind } from "@/lib/types";

// Ported from readest's reader (FoliateViewer.tsx + usePagination.ts +
// iframeEventHandlers.ts, desktop subset): the same open-sequence attributes
// for both renderers (foliate-paginator for EPUB, foliate-fxl for PDF),
// injected stylesheet, iframe event relay with click zones and double-click
// protection, and rAF-coalesced relocation. Shell glue (locator sync, CFI
// highlights, selection capture) stays Segue's.

const DOUBLE_CLICK_INTERVAL_THRESHOLD_MS = 250;
const LONG_HOLD_THRESHOLD = 500;

// The element whose geometry feeds the scrollbar metrics channel
// ("segue-reader-scroll"): the paginator's #container for reflowable
// content, the fxl host itself (overflow: auto) for fixed layout — the same
// split view.js uses to pick the renderer. Seeks do not go through it: the
// position axis is the whole-book fraction (see applySeek).
function scrollerOf(view: FoliateView): HTMLElement | null {
  if (view.isFixedLayout) return view.renderer;
  return (view.renderer.shadowRoot?.getElementById("container") as HTMLElement | null) ?? null;
}

function clamp01(f: number): number {
  return Math.min(1, Math.max(0, f));
}

// usePagination.ts viewPagination (Segue subset): in scrolled flow a turn is
// one viewport scroll (scrollingOverlap = 0); RTL books flip left/right.
// The fxl renderer (PDF) exposes no `scrolled` flag, so page turns fall
// through to plain prev()/next().
const viewPagination = (
  view: FoliateView,
  settings: EpubViewSettings,
  side: "left" | "right" | "up" | "down",
) => {
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
  const progressRef = useRef<SectionProgress | null>(null);
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
  // The scrollbar's position axis for reflowable content: the whole-book
  // fraction of the last relocate. Scroll events between relocates report the
  // same stored value, so every path into the pane feeds one coordinate
  // system and the thumb never jumps between axes.
  const lastFractionRef = useRef<number | undefined>(undefined);
  // The single metrics channel for the pane's scrollbar thumb: the scroller's
  // geometry plus the position axis — whole-book fraction for reflowable
  // content (size-weighted, stable across section load/evict; undefined until
  // the first relocate), pixel fraction for fixed layout. `live` tells the
  // pane the drag style: fixed layout follows a dragged thumb with real pixel
  // scrolls (stable range, cheap rasterization); reflowable content scrubs
  // locally and seeks once on release (section loads are main-thread work).
  // Relocates seed the metrics even when nothing user-scrolled yet (EPUB
  // opens at the top with no native scroll event), and scrolls between
  // relocates re-report the same stored fraction so both paths agree.
  const reportMetrics = () => {
    const v = viewRef.current;
    if (!v) return;
    const el = scrollerOf(v);
    if (!el) return;
    root.current?.dispatchEvent(
      new CustomEvent("segue-reader-scroll", {
        bubbles: true,
        composed: true,
        detail: {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          fraction: v.isFixedLayout ? undefined : lastFractionRef.current,
          live: v.isFixedLayout,
        },
      }),
    );
  };
  const commitRelocate = useRef(() => {});
  commitRelocate.current = () => {
    if (relocateRaf.current != null) {
      cancelAnimationFrame(relocateRaf.current);
      relocateRaf.current = null;
    }
    window.clearTimeout(relocateTimer.current);
    const detail = pendingRelocate.current;
    pendingRelocate.current = null;
    if (!detail) return;
    const v = viewRef.current;
    if (v) {
      if (!v.isFixedLayout && typeof detail.fraction === "number") {
        lastFractionRef.current = detail.fraction;
      }
      reportMetrics();
    }
    if (!detail.cfi) return;

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

    // foliate's default for external links is window.open — route them to the
    // host instead: a new browser tab.
    const onExternalLink = (e: Event) => {
      e.preventDefault();
      const href = (e as CustomEvent<{ a: HTMLAnchorElement; href: string }>).detail?.href;
      if (href) void host().openExternal(href);
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
    // handlePageFlip, desktop subset — no touch/autoscroll/word-lens; wheel
    // events need no relay in scrolled flow, the renderer scrolls natively).
    // Events from inside the book iframe can't reach the shell, so handlers
    // on the section document postMessage to the window, where one message
    // listener routes them into the pagination funnel.
    // -------------------------------------------------------------------
    let isMouseDown = false;
    let lastClickTime = 0;
    let longHoldTimeout = 0;
    let singleClickTimer = 0;

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
      if (now - lastClickTime < DOUBLE_CLICK_INTERVAL_THRESHOLD_MS) {
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
    // Scrollbar drag from the pane (ReaderPane), rAF-coalesced. The target is
    // a whole-book fraction — not a container offset, which stalls under a
    // dragged thumb: the scrolled-mode container's height is a spine-size
    // estimate that foliate rewrites as sections load/evict, with anchor
    // corrections on top. Reflowable content resolves the fraction through
    // SectionProgress (built from the same spine sizes view.js uses for
    // relocate progress) and lets renderer.goTo handle loading and anchoring
    // — renderer.goTo, not view.goToFraction, to skip its per-call history
    // entry. Fixed layout maps the fraction onto the host's stable pixel
    // range instead.
    let pendingSeek: number | null = null;
    let seekRaf: number | null = null;
    const applySeek = () => {
      seekRaf = null;
      const v = viewRef.current;
      const f = pendingSeek;
      pendingSeek = null;
      if (!v || typeof f !== "number") return;
      if (v.isFixedLayout) {
        const el = v.renderer;
        const max = el.scrollHeight - el.clientHeight;
        el.scrollTop = clamp01(f) * max;
        return;
      }
      const progress = progressRef.current;
      if (!progress) return;
      const [index, anchor] = progress.getSection(clamp01(f));
      void v.renderer.goTo({ index, anchor });
    };
    const onSeek = (e: Event) => {
      const f = (e as CustomEvent<{ fraction?: number }>).detail?.fraction;
      if (typeof f !== "number") return;
      pendingSeek = f;
      if (seekRaf == null) seekRaf = requestAnimationFrame(applySeek);
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("segue-reader-seek", onSeek);

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
    // Relay those scrolls outward so the pane's scrollbar keeps up per-frame
    // (relocates are debounced by the paginator and correct position as they
    // arrive). Capture phase: scroll doesn't bubble, the fxl strip scrolls on
    // its own host element, and the paginator's container sits one shadow
    // root deeper. The event target is ignored on purpose — nested scrollables
    // inside the book must not move the thumb; the container's geometry plus
    // the stored fraction is the only truth.
    const onScrollerScroll = () => reportMetrics();

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
      const newRtl = getPageProgressionRTL(v.book.dir, writingDir.rtl);
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
        // Same construction as view.js: the spine-size-weighted fraction axis
        // the scrollbar drags along (reflowable only).
        progressRef.current = fixed ? null : new SectionProgress(book.sections, 1500, 1600);
        if (rendition && fixed) {
          rendition.spread = "auto";
          const cover = book.sections[0];
          if (cover && cover.pageSpread !== "center") cover.pageSpread = "";
        }

        await view.open(book);
        if (cancelled) return;
        view.shadowRoot?.addEventListener("scroll", onScrollerScroll, true);
        view.renderer.shadowRoot?.addEventListener("scroll", onScrollerScroll, true);

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
      window.removeEventListener("segue-reader-seek", onSeek);
      window.removeEventListener("keydown", onWindowKeydown);
      if (seekRaf != null) cancelAnimationFrame(seekRaf);
      progressRef.current = null;
      dropRelayObserver?.disconnect();
      window.clearTimeout(singleClickTimer);
      window.clearTimeout(relocateTimer.current);
      if (relocateRaf.current != null) cancelAnimationFrame(relocateRaf.current);
      if (view) {
        view.shadowRoot?.removeEventListener("scroll", onScrollerScroll, true);
        view.renderer.shadowRoot?.removeEventListener("scroll", onScrollerScroll, true);
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
