// Type surface of the vendored foliate-js EPUB CFI module.

export declare const isCFI: RegExp;
export declare const parse: (cfi: string) => unknown[];
export declare const toString: (parsed: unknown) => string;
export declare const collapse: (x: string, toEnd?: boolean) => string;
export declare const compare: (a: string, b: string) => number;
export declare const buildRange: (from: string, to: string) => string;
// Range CFI relative to the section document (the part after "!").
export declare const fromRange: (range: Range, filter?: (node: Node) => number) => string;
export declare const toRange: (
  doc: Document,
  parts: unknown,
  filter?: (node: Node) => number,
) => Range;
export declare const fromElements: (elements: Element[]) => string;
export declare const toElement: (doc: Document, parts: unknown) => Element;
// Joins CFI parts with "!" and wraps the result: joinIndir(spine, inner) is
// the full "epubcfi(/6/4!/4/2)" form view.getCFI produces.
export declare const joinIndir: (...cfis: string[]) => string;
export declare const fake: {
  fromIndex: (index: number) => string;
  toIndex: (parsed: unknown) => number;
};
