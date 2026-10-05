// Both formats run on readest's foliate-js fork (vendored at src/foliate-js):
// makeBook sniffs the container and hands back the book object (EPUB spine /
// PDF pages), and the reader renders both through foliate's own renderers.
// This module shares one book per file buffer with the reader and derives the
// AI-side sections (text for chunks/excerpts), the ToC outline, and quote→CFI
// resolution for agent-created highlights.

import * as CFI from "@/foliate-js/epubcfi.js";
import { makeBook, type FoliateBook, type FoliateTocItem } from "@/foliate-js/view.js";
import type { DocKind, OutlineItem, ParsedDoc, Section } from "../types";
import { slugify } from "../utils";

// One book per file buffer: parse and reader share the same ArrayBuffer
// instance (fileCache), so the package is opened exactly once. makeBook
// sniffs formats by file name, so the bytes must arrive as a named File — a
// bare Blob has no name and crashes there.
const bookCache = new WeakMap<ArrayBuffer, Promise<FoliateBook>>();

export async function getBook(data: ArrayBuffer, name = "book.epub"): Promise<FoliateBook> {
  let book = bookCache.get(data);
  if (!book) {
    book = makeBook(new File([data], name));
    bookCache.set(data, book);
  }
  return book;
}

// Release a book's parser state and forget the cache entry (a PDF book holds
// a pdf.js document whose dedicated worker survives GC — readest #5387).
// Called when the reader closes; a re-open re-opens the package fresh.
export function dropBook(data: ArrayBuffer): void {
  const book = bookCache.get(data);
  bookCache.delete(data);
  if (book) void book.then((b) => b.destroy?.());
}

export async function parseFoliate(
  data: ArrayBuffer,
  filename: string,
  kind: DocKind,
): Promise<ParsedDoc> {
  const name =
    kind === "pdf" ? "book.pdf" : filename.endsWith(".epub") ? filename : `${filename}.epub`;
  const book = await getBook(data, name);
  return kind === "pdf" ? parsePdfBook(book) : parseEpubBook(book);
}

// PDF: one section per page. The locator is the human-readable p.N; the CFI
// is foliate's synthetic per-section one (it encodes the page index, which is
// what the reader and the overlayer resolve against).
async function parsePdfBook(book: FoliateBook): Promise<ParsedDoc> {
  const sections: Section[] = [];
  for (const [i, section] of book.sections.entries()) {
    let text = "";
    try {
      text = pdfPageText(await section.createDocument());
    } catch {
      // unreadable page: keep the slot (index alignment), no text
    }
    sections.push({
      locator: `p.${i + 1}`,
      heading: `Page ${i + 1}`,
      text,
      cfi: CFI.fake.fromIndex(i),
    });
  }

  const outline: OutlineItem[] = [];
  const walk = (items: FoliateTocItem[] | null | undefined, level: number) => {
    for (const item of items ?? []) {
      const page = tocItemPage(item);
      if (page) outline.push({ locator: `p.${page}`, heading: item.label?.trim() ?? "", level });
      walk(item.subitems, level + 1);
    }
  };
  walk(book.toc, 1);

  return {
    title: langText(book.metadata?.title),
    author: contributorText(book.metadata?.author),
    kind: "pdf",
    sections,
    outline,
  };
}

// The fork's makeTOCItem resolves each outline destination to its page index.
function tocItemPage(item: FoliateTocItem): number | null {
  const index = item.index;
  return typeof index === "number" && index >= 0 ? index + 1 : null;
}

async function parseEpubBook(book: FoliateBook): Promise<ParsedDoc> {
  const sections: Section[] = [];
  const docs = new Map<number, Document>();
  for (const [i, section] of book.sections.entries()) {
    let text = "";
    let heading = "";
    try {
      const doc = await section.createDocument();
      docs.set(i, doc);
      text = extractText(doc);
      heading = firstHeading(doc);
    } catch {
      // unreadable section: keep the slot (index alignment), no text
    }
    if (!heading) heading = `Chapter ${i + 1}`;
    sections.push({
      locator: `ch.${i + 1}:${slugify(heading)}`,
      heading,
      text,
      src: String(section.id),
      cfi: section.cfi || CFI.fake.fromIndex(i),
    });
  }
  if (!sections.length) throw new Error("EPUB contained no readable chapters");

  // ToC outline: one entry per book ToC item at its nesting level; the locator
  // is the precise CFI of the destination (the section's spine CFI when the
  // item has no usable fragment), so outline jumps and position tracking are
  // exact rather than chapter-granular.
  const outline: OutlineItem[] = [];
  const walk = (items: FoliateTocItem[] | null | undefined, level: number) => {
    for (const item of items ?? []) {
      const cfi = tocItemCfi(book, docs, item.href);
      if (cfi) outline.push({ locator: cfi, heading: item.label?.trim() ?? "", level });
      walk(item.subitems, level + 1);
    }
  };
  walk(book.toc, 1);

  return {
    title: langText(book.metadata?.title),
    author: contributorText(book.metadata?.author),
    kind: "epub",
    sections,
    outline,
  };
}

// The PDF text layer lays each text item out as one child of .textLayer —
// items are line fragments, so they join with line breaks.
function pdfPageText(doc: Document): string {
  const layer = doc.querySelector(".textLayer");
  if (!layer) return "";
  return Array.from(layer.children)
    .map((el) => el.textContent?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

// Resolve a ToC entry's href to the full CFI of its destination. Absolute
// URLs (external links) and unresolvable paths yield null — the entry is
// dropped, like the engine's unresolved destinations were.
function tocItemCfi(book: FoliateBook, docs: Map<number, Document>, href: string): string | null {
  if (!href || isAbsoluteUrl(href)) return null;
  try {
    const split = book.splitTOCHref?.(href);
    if (!split) return null;
    const [path, frag] = split;
    const idx = book.sections.findIndex(
      (s) => typeof s.id === "string" && (s.id === path || safeDecode(s.id) === safeDecode(path)),
    );
    if (idx < 0) return null;
    const base = book.sections[idx]!.cfi || CFI.fake.fromIndex(idx);
    const doc = docs.get(idx);
    if (!doc || !frag || !book.getTOCFragment) return base;
    const el = book.getTOCFragment(doc, frag);
    if (!el) return base;
    const range = doc.createRange();
    range.selectNodeContents(el);
    return CFI.joinIndir(base, CFI.fromRange(range));
  } catch {
    return null;
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// url::IsAbsolute: a scheme before any path or fragment
function isAbsoluteUrl(url: string): boolean {
  return /^[^/?#]+:/i.test(url);
}

// Agent add_highlight: resolve a quote to a CFI so the highlight renders in
// the reader like a user selection. Sections are tried in reading order with
// the hinted one first; an unresolvable quote yields null (listed, not drawn).
export async function findQuoteCfi(
  book: FoliateBook,
  order: number[],
  quote: string,
): Promise<string | null> {
  for (const i of order) {
    const section = book.sections[i];
    try {
      const doc = await section.createDocument();
      const range = findQuoteRange(doc, quote);
      if (!range) continue;
      const base = section.cfi || CFI.fake.fromIndex(i);
      return CFI.joinIndir(base, CFI.fromRange(range));
    } catch {
      // unreadable section: try the next one
    }
  }
  return null;
}

const QUOTE_SKIP = new Set(["SCRIPT", "STYLE", "HEAD", "SVG", "TEMPLATE"]);

// 1:1 character canonicalization (never changes lengths — the corpus maps
// back to raw offsets), so model quotes with straight quotes or dashes match
// typographic ones.
const canonChar = (ch: string): string => {
  if (ch === "\u2019" || ch === "\u2018" || ch === "\u0060") return "'";
  if (ch === "\u201C" || ch === "\u201D") return '"';
  if (ch === "\u2013" || ch === "\u2014") return "-";
  if (ch === "\u2026") return ".";
  return ch;
};

// Find `quote` in the document's text (whitespace-insensitive) and return the
// DOM range covering it. Builds a whitespace-collapsed corpus with a
// per-character map back to (text node, raw offset), so the returned range
// selects the original nodes.
function findQuoteRange(doc: Document, quote: string): Range | null {
  const q = [...quote.replace(/\s+/g, " ").trim()].map(canonChar).join("");
  if (q.length < 2) return null;
  // XHTML sections parse as XML documents, which have no .body property —
  // documentElement covers those.
  const root = doc.body ?? doc.documentElement;

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let norm = "";
  const nodes: Text[] = [];
  const offsets: number[] = [];
  let pendingSpace = false;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    if (parent && QUOTE_SKIP.has(parent.tagName.toUpperCase())) continue;
    const raw = textNode.nodeValue ?? "";
    for (let i = 0; i < raw.length; i++) {
      const ch = canonChar(raw[i]!);
      if (/\s/.test(ch)) {
        pendingSpace = true;
        continue;
      }
      if (pendingSpace && norm.length > 0) {
        norm += " ";
        nodes.push(textNode);
        offsets.push(i);
      }
      pendingSpace = false;
      norm += ch;
      nodes.push(textNode);
      offsets.push(i);
    }
    // an element boundary counts as whitespace
    pendingSpace = true;
  }

  // model quotes drift (ellipsis, leading fragments) — full match first,
  // then shorter heads
  let needle = q;
  let start = norm.indexOf(needle);
  if (start < 0) {
    needle = q.slice(0, 80);
    start = needle.length >= 8 ? norm.indexOf(needle) : -1;
  }
  if (start < 0) {
    needle = q.slice(0, 30);
    start = needle.length >= 8 ? norm.indexOf(needle) : -1;
  }
  if (start < 0) return null;
  const end = start + needle.length - 1;

  const range = doc.createRange();
  range.setStart(nodes[start]!, offsets[start]!);
  range.setEnd(nodes[end]!, offsets[end]! + 1);
  return range;
}

// metadata values may be plain strings, language maps ({en: "…"}) or arrays
function langText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return langText(value[0]);
  if (value && typeof value === "object") {
    const first = Object.values(value).find((v) => typeof v === "string") as string | undefined;
    return first?.trim() ?? "";
  }
  return "";
}

function contributorText(value: unknown): string {
  if (Array.isArray(value)) return value.map(langText).filter(Boolean).join(", ");
  return langText(value);
}

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "HEAD", "SVG", "TEMPLATE", "LINK", "META"]);

// block-level elements become line breaks; inline text joins without spaces
const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "BODY",
  "BR",
  "CAPTION",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TD",
  "TH",
  "TR",
  "UL",
]);

function extractText(doc: Document): string {
  const root = doc.body ?? doc.documentElement;
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push(node.nodeValue ?? "");
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      if (SKIP_TAGS.has(el.tagName.toUpperCase())) return;
      const block = BLOCK_TAGS.has(el.tagName.toUpperCase());
      if (block) out.push("\n");
      for (const child of el.childNodes) walk(child);
      if (block) out.push("\n");
    }
  };
  walk(root);
  return out
    .join("")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function firstHeading(doc: Document): string {
  const root = doc.body ?? doc.documentElement;
  const h = root.querySelector("h1,h2,h3,h4,h5,h6");
  return (h?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
}
