// Type surface of the vendored progress.js — Segue uses SectionProgress for
// the scrollbar: it maps spine sizes to a stable whole-book fraction axis
// (the same instance view.js builds at open for relocate progress).
export class SectionProgress {
  constructor(
    sections: { size?: number; linear?: string }[],
    sizePerLoc: number,
    sizePerTimeUnit: number,
  )
  getProgress(
    index: number,
    fractionInSection: number,
    pageFraction?: number,
  ): {
    fraction: number
    section: { current: number; total: number }
    location: { current: number; next: number; total: number }
    time: { section: number; total: number }
  }
  getSection(fraction: number): [index: number, fractionInSection: number]
}
