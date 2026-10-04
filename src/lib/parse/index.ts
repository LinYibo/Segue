import type { DocKind, ParsedDoc } from "../types";
import { parseFoliate } from "./foliate";

// Both kinds run on the foliate fork — makeBook sniffs the container; the
// kind only selects the section model (PDF pages vs EPUB spine).
export async function parseDocument(
  kind: DocKind,
  data: ArrayBuffer,
  filename: string,
): Promise<ParsedDoc> {
  return parseFoliate(data, filename, kind);
}

export function kindFromName(name: string): DocKind | null {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".epub")) return "epub";
  return null;
}
