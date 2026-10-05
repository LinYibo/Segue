import type { Chunk, OutlineItem, ParsedDoc, Section } from "./types";

const TARGET = 900;
const OVERLAP = 140;

export function chunkParsed(docId: string, parsed: ParsedDoc): Chunk[] {
  const out: Chunk[] = [];
  let index = 0;
  for (const section of parsed.sections) {
    const pieces = splitWindow(section.text, TARGET, OVERLAP);
    if (!pieces.length) continue;
    for (const text of pieces) {
      out.push({
        id: `${docId}:${index}`,
        docId,
        locator: section.locator,
        heading: section.heading,
        text,
        index,
      });
      index += 1;
    }
  }
  return out;
}

export function outlineFromSections(sections: Section[]): OutlineItem[] {
  return sections.map((s) => ({
    locator: s.locator,
    heading: s.heading,
    level: headingLevel(s.locator, s.heading),
  }));
}

function headingLevel(locator: string, heading: string): number {
  if (locator.startsWith("p.")) return 2;
  if (locator.startsWith("ch.")) return 1;
  return heading.length > 48 ? 3 : 2;
}

function splitWindow(text: string, target: number, overlap: number): string[] {
  const clean = text
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!clean) return [];
  if (clean.length <= target + 80) return [clean];
  const parts: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(clean.length, i + target);
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const lastStop = Math.max(
        slice.lastIndexOf("。"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("\n"),
      );
      if (lastStop > target * 0.45) end = i + lastStop + 1;
    }
    const piece = clean.slice(i, end).trim();
    if (piece) parts.push(piece);
    if (end >= clean.length) break;
    i = Math.max(i + 1, end - overlap);
  }
  return parts;
}
