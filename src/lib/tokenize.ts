const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "is",
  "it",
  "as",
  "at",
  "by",
  "be",
  "this",
  "that",
  "with",
  "from",
  "are",
  "was",
  "were",
  "but",
  "not",
  "you",
  "your",
  "we",
  "they",
  "their",
  "its",
  "if",
  "into",
  "than",
  "then",
  "so",
  "can",
  "will",
  "just",
  "about",
  "over",
  "such",
]);

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z0-9][a-z0-9'-]*/g) ?? [];
  for (const w of words) {
    if (w.length < 2 || STOP.has(w)) continue;
    tokens.push(w);
  }
  const cjk = lower.match(/[\u3400-\u9fff]+/g) ?? [];
  for (const run of cjk) {
    if (run.length === 1) {
      tokens.push(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i++) {
      tokens.push(run.slice(i, i + 2));
    }
  }
  return tokens;
}
