// Type surface of the vendored foliate-js overlayer (readest's fork: the
// constructor takes the document, static draw functions build the SVG shapes).

export class Overlayer {
  constructor(doc?: Document);
  add(
    value: string,
    range: Range,
    draw: (rects: Range[] | DOMRect[], options?: Record<string, unknown>) => SVGElement,
    options?: Record<string, unknown>,
  ): SVGElement | null;
  remove(value: string): void;
  hitTest(
    e: MouseEvent | { clientX: number; clientY: number },
  ): [string, Range, DOMRect] | [];
  static highlight(
    rects: Range[] | DOMRect[],
    options?: { color?: string; padding?: number; vertical?: boolean } & Record<string, unknown>,
  ): SVGElement;
  static underline(
    rects: Range[] | DOMRect[],
    options?: { color?: string; padding?: number; vertical?: boolean } & Record<string, unknown>,
  ): SVGElement;
  static squiggly(
    rects: Range[] | DOMRect[],
    options?: { color?: string; padding?: number; vertical?: boolean } & Record<string, unknown>,
  ): SVGElement;
  static outline(
    rects: Range[] | DOMRect[],
    options?: { color?: string } & Record<string, unknown>,
  ): SVGElement;
}
