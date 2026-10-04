// Type surface of the vendored foliate-js (readest's fork of
// johnfactotum/foliate-js). Segue uses makeBook + the book objects (EPUB
// spine / PDF pages) for parsing, and the full <foliate-view> widget for
// reading both formats (paginator / foliate-fxl, overlayer, CFIs) — the same
// layering readest's own reader uses.

export type FoliateTocItem = {
  label?: string;
  href: string;
  // PDF only: the fork's makeTOCItem resolves the destination to a page index.
  index?: number;
  subitems?: FoliateTocItem[] | null;
};

// PDF sections load into {src, data, onZoom}: src is the blob URL of the page
// document (#canvas + .textLayer + .annotationLayer), onZoom re-renders the
// page bitmap into the live iframe at a new scale.
export type FoliateLoadResult = {
  src: string;
  data?: string;
  onZoom?: (opts: { doc: Document; scale: number; pageColors?: unknown }) => unknown;
};

export type FoliateSection = {
  // manifest href (zip path) of the section's document — a page index for PDF
  id: string | number;
  // spine-level CFI ("epubcfi(/6/4)"); PDF sections carry none
  cfi?: string;
  linear?: string;
  size?: number;
  pageSpread?: string;
  // iframe-ready blob URL (resources rewritten), cached by the loader
  load: () => Promise<string | FoliateLoadResult>;
  unload: () => void;
  createDocument: () => Promise<Document>;
  resolveHref: (href: string) => string;
};

export type FoliateAnchor = { index: number; anchor?: (doc: Document) => Range };

export type FoliateBook = {
  metadata?: Record<string, unknown>;
  toc?: FoliateTocItem[];
  pageList?: unknown[];
  sections: FoliateSection[];
  dir?: string;
  rendition?: { layout?: string; spread?: string; viewport?: { width: number; height: number } };
  splitTOCHref?: (href: string) => [string, string] | null;
  getTOCFragment?: (doc: Document, id: string) => Element | null;
  resolveCFI?: (cfi: string) => FoliateAnchor;
  resolveHref?: (href: string) => FoliateAnchor | null;
  isExternal?: (uri: string) => boolean;
  getCover?: () => Promise<Blob | null>;
  // PDF books hold a pdf.js document whose worker survives GC; readest #5387.
  destroy?: () => void;
  // EventTarget that fires "load"/"data" for every resource the loader
  // produces; handlers may replace detail.data (the book-CSS rewriter).
  transformTarget?: EventTarget;
};

export type FoliateRenderer = HTMLElement & {
  open: (book: FoliateBook) => Promise<void>;
  goTo: (target: { index: number; anchor?: number | ((doc: Document) => Range) }) => Promise<void>;
  next: (distance?: number) => Promise<void>;
  prev: (distance?: number) => Promise<void>;
  getContents: () => { doc: Document; index: number; overlayer?: unknown }[];
  setStyles?: (css: string) => void;
  destroy: () => void;
  // Scrolled flow: turns become one-viewport scrolls of `size` px.
  scrolled: boolean;
  size: number;
};

// Detail of the view's "relocate" event (readest coalesces it rAF-side; the
// shape is foliate's lastLocation). section.current is the 0-based spine index.
export type RelocateDetail = {
  reason?: string;
  range?: Range | null;
  index?: number;
  fraction?: number;
  cfi: string;
  section?: { current: number; total: number };
  location?: { current: number; next: number; total: number };
  time?: { section: number; total: number };
  tocItem?: { label: string; href: string } | null;
};

export type FoliateView = HTMLElement & {
  open: (book: FoliateBook) => Promise<void>;
  close: () => void;
  // lastLocation passes through resolveNavigation, which takes numbers too
  // (a PDF page index restores directly).
  init: (options: { lastLocation?: string | number; showTextStart?: boolean }) => Promise<void>;
  goTo: (target: string | number | { fraction: number }) => Promise<FoliateAnchor | undefined>;
  goToFraction: (fraction: number) => Promise<void>;
  prev: (distance?: number) => Promise<void>;
  next: (distance?: number) => Promise<void>;
  getCFI: (index: number, range?: Range) => string;
  resolveCFI: (cfi: string) => FoliateAnchor;
  resolveNavigation: (target: string | number | { fraction: number }) => FoliateAnchor | undefined;
  // The view keeps no registry of its own — the host re-adds annotations on
  // "create-overlay" for each section that renders.
  addAnnotation: (
    annotation: { value: string },
    remove?: boolean,
  ) => Promise<{ index: number; label: string }>;
  book: FoliateBook;
  lastLocation: { cfi?: string; range?: Range | null } | null;
  isFixedLayout: boolean;
  renderer: FoliateRenderer;
  history: {
    back: () => void;
    forward: () => void;
    canGoBack: boolean;
    canGoForward: boolean;
  };
};

export function makeBook(file: File | Blob | string): Promise<FoliateBook>;
