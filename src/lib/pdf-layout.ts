// Port of SumatraPDF's page layout for the reader's continuous single-column
// view: sumatrapdf/src/DocumentLayout.cpp (Relayout, PagePixelSize,
// ZoomRealFromVirtualForPage, CurrentPageNo, PageNoAtViewPortTop) and
// DisplayModel::SetUiDpi / GoToPage. All geometry is computed in device
// pixels: user-facing metrics are defined at 100% scaling and multiplied by
// the DPI factor (MulDiv(n, dpi, 96)), and page sizes round mediaBox × zoom,
// so what the layout computes is exactly what renders.

export const kZoomFitWidth = -2;

export type Size = { dx: number; dy: number };
export type Margin = { top: number; right: number; bottom: number; left: number };

export type LayoutPage = {
  mediaBox: Size; // document units (PDF points)
  pos: { x: number; y: number; dx: number; dy: number }; // device pixels
  zoomReal: number; // device pixels per document unit
  visibleRatio: number;
};

export type LayoutParams = {
  viewPortSize: Size; // device pixels
  zoomVirtual: number;
  dpiFactor: number;
  windowMargin: Margin;
  pageSpacing: Size;
};

export type DocumentLayout = {
  pages: LayoutPage[];
  canvasSize: Size;
  zoomReal: number;
  params: LayoutParams;
};

// DisplayModel::SetUiDpi — MulDiv(n, dpi, 96)
export function scaleForDpi(n: number, dpi: number): number {
  return Math.round((n * dpi) / 96);
}

// WindowMargin / PageSpacing defaults from Settings.h (gWindowMarginFields,
// gSizeFields): top 2, right 4, bottom 2, left 4; spacing 4 × 4.
export function uiMetrics(dpi: number): { windowMargin: Margin; pageSpacing: Size } {
  const s = (n: number) => scaleForDpi(n, dpi);
  return {
    windowMargin: { top: s(2), right: s(4), bottom: s(2), left: s(4) },
    pageSpacing: { dx: s(4), dy: s(4) },
  };
}

// PagePixelSize: round the scaled media box.
function pagePixelSize(pageSize: Size, zoom: number): Size {
  if (zoom <= 0 || pageSize.dx <= 0 || pageSize.dy <= 0) return { dx: 0, dy: 0 };
  return { dx: Math.round(pageSize.dx * zoom), dy: Math.round(pageSize.dy * zoom) };
}

// ZoomRealFromVirtualForPage, kZoomFitWidth: each page fills the viewport
// width minus the window margins (per-page zoom, usePageZooms).
function fitWidthZoom(mediaBox: Size, params: LayoutParams): number {
  const areaDx = params.viewPortSize.dx - params.windowMargin.left - params.windowMargin.right;
  if (areaDx <= 0 || mediaBox.dx <= 0) return 0;
  return areaDx / mediaBox.dx;
}

// DocumentLayout::Relayout, continuous single-column path, plus the
// FinishRelayout canvas sizing and the vertical centering of documents
// shorter than the viewport.
export function relayout(mediaBoxes: Size[], params: LayoutParams): DocumentLayout {
  const pages: LayoutPage[] = mediaBoxes.map((mediaBox) => ({
    mediaBox,
    pos: { x: 0, y: 0, dx: 0, dy: 0 },
    zoomReal: 0,
    visibleRatio: 0,
  }));

  // CalcZoomReal with usePageZooms: every shown page carries its own zoom.
  let minZoom = Infinity;
  for (const page of pages) {
    page.zoomReal = fitWidthZoom(page.mediaBox, params);
    if (page.zoomReal > 0) minZoom = Math.min(minZoom, page.zoomReal);
  }
  const zoomReal = minZoom === Infinity ? 1 : minZoom;
  for (const page of pages) {
    if (!(page.zoomReal > 0)) page.zoomReal = zoomReal;
  }

  const { windowMargin: m, pageSpacing } = params;

  let currPosY = m.top;
  let columnMaxWidth = 0;
  for (const page of pages) {
    const px = pagePixelSize(page.mediaBox, page.zoomReal);
    page.pos.dx = px.dx;
    page.pos.dy = px.dy;
    page.pos.y = currPosY;
    columnMaxWidth = Math.max(columnMaxWidth, px.dx);
    currPosY += px.dy + pageSpacing.dy;
  }
  const canvasDy = currPosY + m.bottom - pageSpacing.dy;
  let canvasDx = m.left + columnMaxWidth + m.right;

  const offX = canvasDx < params.viewPortSize.dx ? (params.viewPortSize.dx - canvasDx) / 2 : 0;
  const pageOffX = offX + m.left;
  for (const page of pages) {
    page.pos.x = pageOffX + ((columnMaxWidth - page.pos.dx) / 2);
  }
  if (canvasDx < params.viewPortSize.dx) canvasDx = params.viewPortSize.dx;

  if (canvasDy < params.viewPortSize.dy) {
    const offY = m.top + Math.floor((params.viewPortSize.dy - canvasDy) / 2);
    for (const page of pages) page.pos.y += offY;
  }

  return {
    pages,
    canvasSize: {
      dx: Math.max(canvasDx, params.viewPortSize.dx),
      dy: Math.max(canvasDy, params.viewPortSize.dy),
    },
    zoomReal,
    params,
  };
}

// RecalcVisibleParts + CurrentPageNo + PageNoAtViewPortTop: the most visible
// page by viewport-intersection area; when no page overlaps at all, the page
// whose vertical band contains the viewport top.
export function currentPageNo(layout: DocumentLayout, scrollTopDev: number, viewPort: Size): number {
  let mostVisible = 1;
  let best = 0;
  let bandPage = layout.pages.length;
  for (let i = 0; i < layout.pages.length; i++) {
    const p = layout.pages[i]!;
    // PageNoAtViewPortTop: first page whose vertical band contains the
    // viewport top (the last page when the viewport is past the end).
    if (bandPage === layout.pages.length && scrollTopDev < p.pos.y + p.pos.dy) {
      bandPage = i + 1;
    }
    const ixDy = Math.min(p.pos.y + p.pos.dy, scrollTopDev + viewPort.dy) - Math.max(p.pos.y, scrollTopDev);
    const ixDx = Math.min(p.pos.x + p.pos.dx, viewPort.dx) - Math.max(p.pos.x, 0);
    if (ixDy > 0 && ixDx > 0 && p.pos.dx > 0 && p.pos.dy > 0) {
      const ratio = (ixDx * ixDy) / (p.pos.dx * p.pos.dy);
      if (ratio > best) {
        best = ratio;
        mostVisible = i + 1;
      }
    }
  }
  return best > 0 ? mostVisible : bandPage;
}

// GoToPage: the page's top (less the window margin) lands at the viewport top.
export function pageScrollTop(layout: DocumentLayout, pageNo: number): number {
  const page = layout.pages[pageNo - 1];
  if (!page) return 0;
  return page.pos.y - layout.params.windowMargin.top;
}
