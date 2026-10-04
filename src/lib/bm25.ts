import type { Chunk } from "./types";
import { tokenize } from "./tokenize";

const K1 = 1.4;
const B = 0.75;

export type SearchHit = {
  chunk: Chunk;
  score: number;
};

export function searchChunks(chunks: Chunk[], query: string, k = 8): SearchHit[] {
  const q = tokenize(query);
  if (!q.length || !chunks.length) return [];

  const docs = chunks.map((c) => tokenize(c.text));
  const df = new Map<string, number>();
  let totalLen = 0;
  for (const tokens of docs) {
    totalLen += tokens.length;
    const uniq = new Set(tokens);
    for (const t of uniq) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const n = docs.length;
  const avgdl = totalLen / n || 1;

  const scores = new Array<number>(n).fill(0);
  for (const term of q) {
    const nq = df.get(term) ?? 0;
    if (!nq) continue;
    const idf = Math.log(1 + (n - nq + 0.5) / (nq + 0.5));
    for (let i = 0; i < n; i++) {
      const tokens = docs[i]!;
      let tf = 0;
      for (const t of tokens) if (t === term) tf++;
      if (!tf) continue;
      const dl = tokens.length || 1;
      const denom = tf + K1 * (1 - B + B * (dl / avgdl));
      scores[i]! += idf * ((tf * (K1 + 1)) / denom);
    }
  }

  return scores
    .map((score, i) => ({ chunk: chunks[i]!, score }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
