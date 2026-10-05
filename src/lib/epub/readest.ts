// Ported from readest's reader layer (apps/readest-app/src): utils/style.ts,
// styles/fonts.ts, libs/document.ts (getDirection), utils/{config,lang}.ts.
// This is the half of readest's reader that lives above the foliate-js fork —
// the injected stylesheet (fonts, paragraph layout, colors), the book-CSS
// rewriter, and the per-document fixups — with Segue's fixed configuration
// substituted for their settings store: light theme only, scrolled flow only,
// no custom fonts, no translation/e-ink features. The emitted CSS therefore
// matches readest's light-desktop output.

// vertical/rtl are the only runtime-variable knobs — the reader overwrites
// them per section from the book's writing direction (getDirection).
export type EpubViewSettings = {
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  gapPercent: number;
  maxColumnCount: number;
  maxInlineSize: number;
  maxBlockSize: number;
  vertical: boolean;
  rtl: boolean;
  serifFont: string;
  sansSerifFont: string;
  monospaceFont: string;
  defaultFont: string;
  defaultCJKFont: string;
  defaultFontSize: number;
  minimumFontSize: number;
  fontWeight: number;
  paragraphMargin: number;
  lineHeight: number;
  wordSpacing: number;
  letterSpacing: number;
  textIndent: number;
  fullJustification: boolean;
  hyphenation: boolean;
};

// Desktop defaults (services/constants.ts DEFAULT_BOOK_FONT/LAYOUT/STYLE);
// the CJK book overrides mirror DEFAULT_CJK_VIEW_SETTINGS. Segue's fixed
// configuration substitutes readest's settings store: light theme only,
// scrolled flow only, no custom fonts, no font/layout/color overrides.
export const makeEpubViewSettings = (isCJK: boolean): EpubViewSettings => ({
  marginTopPx: 44,
  marginRightPx: 16,
  marginBottomPx: 44,
  marginLeftPx: 16,
  gapPercent: 5,
  maxColumnCount: 2,
  maxInlineSize: getDefaultMaxInlineSize(),
  maxBlockSize: getDefaultMaxBlockSize(),
  vertical: false,
  rtl: false,
  serifFont: "Bitter",
  sansSerifFont: "Roboto",
  monospaceFont: "Consolas",
  defaultFont: "Serif",
  defaultCJKFont: "LXGW WenKai GB Screen",
  defaultFontSize: 16,
  minimumFontSize: 8,
  fontWeight: 400,
  paragraphMargin: isCJK ? 1 : 0.6,
  lineHeight: isCJK ? 1.6 : 1.4,
  wordSpacing: 0,
  letterSpacing: 0,
  textIndent: isCJK ? 2 : 0,
  fullJustification: true,
  hyphenation: true,
});

// utils/misc.ts isCJKEnv — readest mounts the CJK webfonts and applies the
// CJK typography defaults for CJK locales, even when the book declares no
// language (settingsService.ts merges DEFAULT_CJK_VIEW_SETTINGS on this).
export const isCJKEnv = (): boolean =>
  ["zh", "ja", "ko"].some((lang) => navigator.language.startsWith(lang));

export const isCJKLang = (lang: string | null | undefined): boolean => {
  if (!lang) return false;
  const normalized = String(lang).toLowerCase().split(/[-_]/)[0]!;
  return ["zh", "ja", "ko", "zho", "jpn", "kor"].includes(normalized);
};

export const getDefaultMaxInlineSize = (): number => {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  return screenWidth < screenHeight ? Math.max(screenWidth, 720) : 720;
};

export const getDefaultMaxBlockSize = (): number => {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  return Math.max(screenWidth, screenHeight, 1440);
};

// Segue's fixed light theme (styles.css tokens) — readest's themeCode.
const THEME = { bg: "#ffffff", fg: "#1c1b18", primary: "#5a6f85" };

// ---------------------------------------------------------------------------
// Fonts (styles/fonts.ts): the same webfont links readest mounts per document.
// ---------------------------------------------------------------------------

const BASIC_GOOGLE_FONTS = [
  { family: "Bitter", weights: "ital,wght@0,100..900;1,100..900" },
  { family: "Fira Code", weights: "wght@300..700" },
  { family: "Literata", weights: "ital,opsz,wght@0,7..72,200..900;1,7..72,200..900" },
  { family: "Merriweather", weights: "ital,opsz,wght@0,18..144,300..900;1,18..144,300..900" },
  { family: "Noto Sans", weights: "ital,wght@0,100..900;1,100..900" },
  { family: "Open Sans", weights: "ital,wght@0,300..800;1,300..800" },
  { family: "Roboto", weights: "ital,wght@0,100..900;1,100..900" },
  { family: "Roboto Slab", weights: "ital,wght@0,100..900;1,100..900" },
  { family: "Vollkorn", weights: "ital,wght@0,400..900;1,400..900" },
  { family: "PT Sans", weights: "ital,wght@0,400;0,700;1,400;1,700" },
  { family: "PT Serif", weights: "ital,wght@0,400;0,700;1,400;1,700" },
  { family: "PT Mono", weights: "" },
];

const CJK_GOOGLE_FONTS = [
  { family: "LXGW WenKai TC", weights: "" },
  { family: "Noto Sans SC", weights: "" },
  { family: "Noto Sans TC", weights: "" },
  { family: "Noto Serif JP", weights: "" },
];

// FONT_BASE_URL-hosted faces skipped: they only answer CORS for readest.com
// (#5550), and none of them is the default CJK font.
const getAdditionalCJKFontLinks = () => `
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/misans-webfont@1.0.4/misans-l3/misans-l3/result.min.css" crossorigin="anonymous" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/lxgw-wenkai-screen-web/1.520.0/lxgwwenkaigbscreen/result.css" crossorigin="anonymous" />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${CJK_GOOGLE_FONTS.map(
    ({ family, weights }) => `family=${encodeURIComponent(family)}${weights ? `:${weights}` : ""}`,
  ).join("&")}&display=swap" crossorigin="anonymous" />
`;

const getAdditionalCJKFontFaces = () => `
  @font-face {
    font-family: "FangSong";
    font-display: swap;
    src: local("Fang Song"), local("FangSong"), local("Noto Serif CJK"), local("Source Han Serif SC VF"), url("https://db.onlinewebfonts.com/t/2ecbfe1d9bfc191c6f15c0ccc23cbd43.eot");
    src: url("https://db.onlinewebfonts.com/t/2ecbfe1d9bfc191c6f15c0ccc23cbd43.eot?#iefix") format("embedded-opentype"),
    url("https://db.onlinewebfonts.com/t/2ecbfe1d9bfc191c6f15c0ccc23cbd43.woff2") format("woff2"),
    url("https://db.onlinewebfonts.com/t/2ecbfe1d9bfc191c6f15c0ccc23cbd43.woff") format("woff"),
    url("https://db.onlinewebfonts.com/t/2ecbfe1d9bfc191c6f15c0ccc23cbd43.ttf") format("truetype"),
    url("https://db.onlinewebfonts.com/t/2ecbfe1d9bfc191c6f15c0ccc23cbd43.svg#FangSong") format("svg");
  }
  @font-face {
    font-family: "Kaiti";
    font-display: swap;
    src: local("Kai"), local("KaiTi"), local("AR PL UKai"), local("LXGW WenKai GB Screen"), url("https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.eot");
    src: url("https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.eot?#iefix")format("embedded-opentype"),
    url("https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.woff2")format("woff2"),
    url("https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.woff")format("woff"),
    url("https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.ttf")format("truetype"),
    url("https://db.onlinewebfonts.com/t/1ee9941f1b8c128110ca4307dda59917.svg#Kaiti") format("svg");
  }
`;

const getAdditionalBasicFontLinks = () => `
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?${BASIC_GOOGLE_FONTS.map(
    ({ family, weights }) => `family=${encodeURIComponent(family)}${weights ? `:${weights}` : ""}`,
  ).join("&")}&display=swap" crossorigin="anonymous">
`;

// mountAdditionalFonts: mount into every section document so the book's own
// CSS can reference the families too.
export const mountBookFonts = (doc: Document, isCJK: boolean): void => {
  if (!doc.head) return; // an SVG spine item has no <head> to mount into
  const links = isCJK
    ? `${getAdditionalBasicFontLinks()}\n${getAdditionalCJKFontLinks()}`
    : getAdditionalBasicFontLinks();
  if (isCJK) {
    const style = doc.createElement("style");
    style.textContent = getAdditionalCJKFontFaces();
    doc.head.appendChild(style);
  }
  const parsed = new DOMParser().parseFromString(links, "text/html");
  for (const child of Array.from(parsed.head.children)) {
    if (child.tagName !== "LINK") continue;
    const link = doc.createElement("link");
    link.rel = child.getAttribute("rel") || "";
    link.href = child.getAttribute("href") || "";
    doc.head.appendChild(link);
  }
};

// ---------------------------------------------------------------------------
// Stylesheet (utils/style.ts)
// ---------------------------------------------------------------------------

const SERIF_FONTS = [
  "Bitter",
  "Literata",
  "Merriweather",
  "Roboto Slab",
  "Vollkorn",
  "PT Serif",
  "Georgia",
  "Times New Roman",
];
const SANS_SERIF_FONTS = ["Roboto", "Noto Sans", "Open Sans", "PT Sans", "Helvetica"];
const MONOSPACE_FONTS = ["Fira Code", "Consolas", "Courier New", "Lucida Console", "PT Mono"];
const FALLBACK_FONTS = ["MiSans L3"];
const CJK_SERIF_FONTS = [
  "LXGW WenKai GB Screen",
  "LXGW WenKai TC",
  "GuanKiapTsingKhai-T",
  "Source Han Serif CN",
  "Huiwen-MinchoGBK",
  "KingHwa_OldSong",
];
const CJK_SANS_SERIF_FONTS = ["Noto Sans SC", "Noto Sans TC"];

const buildFontFamilyLists = (
  serif: string,
  sansSerif: string,
  monospace: string,
  defaultCJKFont: string,
) => {
  const lastSerifFonts = ["Georgia", "Times New Roman"];
  const serifFonts = [
    serif,
    ...(defaultCJKFont !== serif ? [defaultCJKFont] : []),
    ...SERIF_FONTS.filter(
      (font) => font !== serif && font !== defaultCJKFont && !lastSerifFonts.includes(font),
    ),
    ...CJK_SERIF_FONTS.filter((font) => font !== serif && font !== defaultCJKFont),
    ...lastSerifFonts.filter(
      (font) => SERIF_FONTS.includes(font) && !lastSerifFonts.includes(defaultCJKFont),
    ),
    ...FALLBACK_FONTS,
  ];
  const sansSerifFonts = [
    sansSerif,
    ...(defaultCJKFont !== sansSerif ? [defaultCJKFont] : []),
    ...SANS_SERIF_FONTS.filter((font) => font !== sansSerif && font !== defaultCJKFont),
    ...CJK_SANS_SERIF_FONTS.filter((font) => font !== sansSerif && font !== defaultCJKFont),
    ...FALLBACK_FONTS,
  ];
  const monospaceFonts = [monospace, ...MONOSPACE_FONTS.filter((font) => font !== monospace)];
  const quote = (fonts: string[]) => fonts.map((font) => `"${font}"`).join(", ");
  return {
    serif: `${quote(serifFonts)}, serif`,
    sansSerif: `${quote(sansSerifFonts)}, sans-serif`,
    monospace: `${quote(monospaceFonts)}, monospace`,
  };
};

const getFontStyles = (s: EpubViewSettings) => {
  const families = buildFontFamilyLists(
    s.serifFont,
    s.sansSerifFont,
    s.monospaceFont,
    s.defaultCJKFont,
  );
  const defaultFontFamily = s.defaultFont.toLowerCase() === "serif" ? "--serif" : "--sans-serif";
  const fontSize = s.defaultFontSize;
  const minFontSize = s.minimumFontSize;
  const fontWeight = s.fontWeight;
  return `
    html {
      --serif: ${families.serif};
      --sans-serif: ${families.sansSerif};
      --monospace: ${families.monospace};
      --font-size: ${fontSize}px;
      --min-font-size: ${minFontSize}px;
      --font-weight: ${fontWeight};
    }
    html, body {
      font-size: ${fontSize}px !important;
      font-weight: ${fontWeight};
      -webkit-text-size-adjust: none;
      text-size-adjust: none;
    }
    :where(html) {
      font-family: var(${defaultFontFamily});
    }
    font[size="1"] {
      font-size: ${minFontSize}px;
    }
    font[size="2"] {
      font-size: ${minFontSize * 1.5}px;
    }
    font[size="3"] {
      font-size: ${fontSize}px;
    }
    font[size="4"] {
      font-size: ${fontSize * 1.2}px;
    }
    font[size="5"] {
      font-size: ${fontSize * 1.5}px;
    }
    font[size="6"] {
      font-size: ${fontSize * 2}px;
    }
    font[size="7"] {
      font-size: ${fontSize * 3}px;
    }
    [style*="font-size: 16px"], [style*="font-size:16px"] {
      font-size: 1rem !important;
    }
    :where(pre, code, kbd) {
      font-family: var(--monospace);
      font-variant-ligatures: none;
    }
  `;
};

const getPageLayoutStyles = (s: EpubViewSettings) => `
  html {
    --margin-top: ${s.marginTopPx}px;
    --margin-right: ${s.marginRightPx}px;
    --margin-bottom: ${s.marginBottomPx}px;
    --margin-left: ${s.marginLeftPx}px;
  }
  html, body {
    max-height: unset;
    -webkit-touch-callout: none;
    -webkit-user-select: text;
  }
  body {
    overflow: unset;
    padding: unset;
    margin: unset;
  }
  img {
    -webkit-touch-callout: none;
    -webkit-user-drag: none;
  }
  svg:where(:not([width])), img:where(:not([width])) {
    width: auto;
  }
  svg:where(:not([height])), img:where(:not([height])) {
    height: auto;
  }
  figure > div:has(img) {
    height: auto !important;
  }
  a {
    position: relative !important;
  }
  a::before {
    content: '';
    position: absolute;
    inset: -10px;
  }

  pre, code {
    white-space: pre-wrap !important;
    scrollbar-width: none;
  }
  math {
    overflow: auto;
    scrollbar-width: none;
    max-height: calc(var(--available-height) * 1px);
  }
  table, math {
    max-width: calc(var(--available-width) * 1px);
  }

  .epubtype-footnote,
  aside[epub|type~="endnote"],
  aside[epub|type~="footnote"],
  aside[epub|type~="note"],
  aside[epub|type~="rearnote"] {
    display: none;
  }

  .duokan-footnote-content,
  .duokan-footnote-item {
    display: none;
  }

  .duokan-image-gallery-cell {
    height: calc(var(--available-height) * 1px);
  }

  .duokan-image-gallery-cell img {
    height: 90%;
  }

  div:has(> img, > svg) {
    max-width: 100% !important;
  }

  figure.code {
    overflow: unset !important;
  }

  p {
    display: block;
  }

  .ie6 img {
    width: unset;
    height: unset;
  }
  sup img {
    height: 1em;
  }
  img.has-text-siblings {
    ${s.vertical ? "width: 1em;" : "height: 1em;"}
  }
  img.has-text-siblings-baseline {
    vertical-align: baseline;
  }
  :is(div) > img.has-text-siblings[style*="object-fit"] {
    display: block;
    height: auto;
    vertical-align: unset;
  }
  .duokan-footnote img:not([class]) {
    width: 0.8em;
    height: 0.8em;
  }
  div:has(img.singlepage) {
    position: relative;
    width: auto;
    height: auto;
  }
  p[width][height] > img:only-child {
    width: unset !important;
  }

  .br {
    display: flow-root;
  }

  .h5_mainbody {
    overflow: unset !important;
  }
`;

// utils/inlineTags.ts INLINE_FORMATTING_TAGS — a div is paragraph-like only
// when every descendant is one of these.
const INLINE_FORMATTING_SELECTOR = [
  "a",
  "b",
  "em",
  "i",
  "strong",
  "u",
  "span",
  "font",
  "sup",
  "sub",
  "small",
  "mark",
].join(", ");

const getParagraphLayoutStyles = (s: EpubViewSettings) => {
  const vertical = s.vertical;
  return `
  html {
    --default-text-align: ${s.fullJustification ? "justify" : "start"};
    hanging-punctuation: allow-end last;
    orphans: 2;
    widows: 2;
  }
  html, body {
    text-align: var(--default-text-align);
  }
  ${s.fullJustification ? "html, body, p, li, blockquote, dd { text-wrap-style: auto !important; }" : ""}
  [align="left"] { text-align: left; }
  [align="right"] { text-align: right; }
  [align="center"] { text-align: center; }
  [align="justify"] { text-align: justify; }
  body {
    line-height: unset;
  }
  :is(hgroup, header) p {
      text-align: unset;
      hyphens: unset;
  }
  p, blockquote, dd, div:not(:has(*:not(${INLINE_FORMATTING_SELECTOR}))) {
    line-height: ${s.lineHeight};
    word-spacing: ${s.wordSpacing}px;
    letter-spacing: ${s.letterSpacing}px;
    text-indent: ${s.textIndent}em;
    -webkit-hyphens: ${s.hyphenation ? "auto" : "manual"};
    hyphens: ${s.hyphenation ? "auto" : "manual"};
    -webkit-hyphenate-limit-before: 3;
    -webkit-hyphenate-limit-after: 2;
    -webkit-hyphenate-limit-lines: 2;
    hanging-punctuation: allow-end last;
    widows: 2;
  }
  li {
    line-height: ${s.lineHeight};
    -webkit-hyphens: ${s.hyphenation ? "auto" : "manual"};
    hyphens: ${s.hyphenation ? "auto" : "manual"};
  }
  p.aligned-center, blockquote.aligned-center,
  dd.aligned-center, div.aligned-center {
    text-align: center;
  }
  p.aligned-right, blockquote.aligned-right,
  dd.aligned-right, div.aligned-right {
    text-align: right;
  }
  p:has(> img:only-child), p:has(> span:only-child > img:only-child),
  p:has(> a:only-child > img:only-child),
  p:has(> span:only-child > a:only-child > img:only-child),
  p:has(> img:not(.has-text-siblings)),
  p:has(> a:first-child + img:last-child) {
    text-indent: initial !important;
  }
  blockquote[align="center"], div[align="center"],
  p[align="center"], dd[align="center"],
  p.aligned-center, blockquote.aligned-center,
  dd.aligned-center, div.aligned-center,
  li p, ol p, ul p, td p {
    text-indent: initial !important;
  }
  p {
    ${vertical ? `margin-left: ${s.paragraphMargin}em;` : ""}
    ${vertical ? `margin-right: ${s.paragraphMargin}em;` : ""}
    ${vertical ? "margin-top: unset;" : ""}
    ${vertical ? "margin-bottom: unset;" : ""}
    ${!vertical ? `margin-top: ${s.paragraphMargin}em;` : ""}
    ${!vertical ? `margin-bottom: ${s.paragraphMargin}em;` : ""}
    ${!vertical ? "margin-left: unset;" : ""}
    ${!vertical ? "margin-right: unset;" : ""}
  }
  p > font:only-child {
    display: flow-root;
  }

  :lang(zh), :lang(ja), :lang(ko) {
    widows: 1;
    orphans: 1;
  }

  div.left *, p.left * { text-align: left; }
  div.right *, p.right * { text-align: right; }
  div.center *, p.center * { text-align: center; }
  div.justify *, p.justify * { text-align: justify; }

  img.pi {
    ${vertical ? "transform: rotate(90deg);" : ""}
    ${vertical ? "transform-origin: center;" : ""}
    ${vertical ? "height: 2em;" : ""}
    ${vertical ? `width: ${s.lineHeight}em;` : ""}
    ${vertical ? "vertical-align: unset;" : ""}
  }


  .nonindent, .noindent {
    text-indent: unset !important;
  }
`;
};

const getColorStyles = () => {
  // Segue is always light — the dark/eink/override branches of readest's
  // getColorStyles all compile away.
  const { bg, fg } = THEME;
  return `
    html {
      --theme-bg-color: ${bg};
      --theme-fg-color: ${fg};
      --theme-primary-color: ${THEME.primary};
      color-scheme: light;
    }
    html, body {
      color: ${fg};
    }
    html[has-background], body[has-background] {
      --background-set: var(--theme-bg-color);
    }
    html {
      background-color: var(--theme-bg-color, transparent);
      background: var(--background-set, none);
    }
    a:any-link {
      text-decoration: none;
    }
    *:has(> hr.background-img):not(body) {
      background-color: ${bg};
    }
    hr.background-img {
      mix-blend-mode: multiply;
    }
    p[width][height] > img:only-child {
      mix-blend-mode: multiply;
    }
    p img.has-text-siblings, span img.has-text-siblings, sup img.has-text-siblings {
      mix-blend-mode: multiply;
    }
    table:has(> colgroup) {
      table-layout: fixed;
    }
    td, th {
      overflow-wrap: break-word;
    }
    font[color="#000000"], font[color="#000"], font[color="black"],
    font[color="rgb(0,0,0)"], font[color="rgb(0, 0, 0)"],
    *[style*="color: rgb(0,0,0)"], *[style*="color: rgb(0, 0, 0)"],
    *[style*="color: #000"], *[style*="color: #000000"], *[style*="color: black"],
    *[style*="color:rgb(0,0,0)"], *[style*="color:rgb(0, 0, 0)"],
    *[style*="color:#000"], *[style*="color:#000000"], *[style*="color:black"] {
      color: ${fg} !important;
    }
    #pg-header * {
      color: inherit !important;
    }
    .x-ebookmaker, .x-ebookmaker-cover, .x-ebookmaker-coverpage {
      background-color: unset !important;
    }
    .chapterHeader, .chapterHeader * {
      border-color: unset;
      background-color: ${bg} !important;
    }
    .calibre {
      color: unset;
      background-color: unset;
    }
  `;
};

export const getStyles = (s: EpubViewSettings): string => {
  const epubNamespace = `@namespace epub "http://www.idpf.org/2007/ops";`;
  return `${epubNamespace}\n${getPageLayoutStyles(s)}\n${getParagraphLayoutStyles(s)}\n${getFontStyles(s)}\n${getColorStyles()}`;
};

// ---------------------------------------------------------------------------
// Book-CSS rewriter (utils/style.ts transformStylesheet) — ported verbatim;
// desktop fontScale is 1.
// ---------------------------------------------------------------------------

// services/transformers/style.ts styleTransformer — section HTML passes
// through here so inline <style> blocks get the same rewrite linked
// stylesheets get from transformStylesheet.
export const transformInlineStyles = (
  html: string,
  vw: number,
  vh: number,
  vertical: boolean,
): string => {
  for (const match of [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/gi)]) {
    const [full, attrs, css] = match;
    const transformed = transformStylesheet(css!, vw, vh, vertical);
    html = html.replace(full, `<style${attrs}>${transformed}</style>`);
  }
  return html;
};

export const transformStylesheet = (
  css: string,
  vw: number,
  vh: number,
  vertical: boolean,
): string => {
  const isInlineStyle = !css.includes("{");
  const ruleRegex = /([^{]+)({[^}]+})/g;
  css = css.replace(ruleRegex, (match, selector, block) => {
    const hasTextAlignCenter = /text-align\s*:\s*center\s*[;$]/.test(block);
    const hasTextIndentZero = /text-indent\s*:\s*0(?:\.0+)?(?:px|em|rem|%)?\s*[;$]/.test(block);

    if (hasTextAlignCenter && hasTextIndentZero) {
      block = block.replace(/(text-align\s*:\s*center)(\s*;|\s*$)/g, "$1 !important$2");
      block = block.replace(
        /(text-indent\s*:\s*0(?:\.0+)?(?:px|em|rem|%)?)(\s*;|\s*$)/g,
        "$1 !important$2",
      );
      return selector + block;
    }
    return match;
  });

  css = css.replace(ruleRegex, (match, selector, block) => {
    const hasWhiteSpaceNowrap = /white-space\s*:\s*nowrap\s*[;$]/.test(block);
    if (hasWhiteSpaceNowrap) {
      if (!/overflow\s*:/.test(block)) {
        block = block.replace(/}$/, " overflow: clip !important; }");
      }
      return selector + block;
    }
    return match;
  });

  if (isInlineStyle) {
    const hasPageBreakAfterAlways = /page-break-after\s*:\s*always\s*[;]?/.test(css);
    if (hasPageBreakAfterAlways && !/margin-bottom\s*:/.test(css)) {
      css = css.replace(/;?\s*$/, "") + "; margin-bottom: calc(var(--available-height) * 1px)";
    }
  } else {
    css = css.replace(ruleRegex, (match, selector, block) => {
      const hasPageBreakAfterAlways = /page-break-after\s*:\s*always\s*[;$]/.test(block);
      if (hasPageBreakAfterAlways) {
        if (!/margin-bottom\s*:/.test(block)) {
          block = block.replace(/}$/, " margin-bottom: calc(var(--available-height) * 1px); }");
        }
        return selector + block;
      }
      return match;
    });
  }

  css = css.replace(ruleRegex, (_, selector, block) => {
    if (vertical) return selector + block;

    const directions: string[] = [];
    let hasBleed = false;
    for (const dir of ["top", "bottom", "left", "right"]) {
      const bleedRegex = new RegExp(`duokan-bleed\\s*:\\s*[^;]*${dir}[^;]*;`);
      const marginRegex = new RegExp(`margin-${dir}\\s*:`);
      if (bleedRegex.test(block) && !marginRegex.test(block)) {
        hasBleed = true;
        directions.push(dir);
        block = block.replace(
          /}$/,
          ` margin-${dir}: calc(-1 * var(--page-margin-${dir})) !important; }`,
        );
      }
    }
    if (hasBleed) {
      if (!/position\s*:/.test(block)) {
        block = block.replace(/}$/, " position: relative !important; }");
      }
      if (!/overflow\s*:/.test(block)) {
        block = block.replace(/}$/, " overflow: hidden !important; }");
      }
      if (!/display\s*:/.test(block)) {
        block = block.replace(/}$/, " display: flow-root !important; }");
      }
      if (directions.includes("left") && directions.includes("right")) {
        block = block
          .replace(/}$/, " width: calc(var(--full-width) * 1px) !important; }")
          .replace(/}$/, " min-width: calc(var(--full-width) * 1px) !important; }")
          .replace(/}$/, " max-width: calc(var(--full-width) * 1px) !important; }");
      }
      if (directions.includes("top") && directions.includes("bottom")) {
        block = block
          .replace(/}$/, " height: calc(var(--full-height) * 1px) !important; }")
          .replace(/}$/, " min-height: calc(var(--full-height) * 1px) !important; }")
          .replace(/}$/, " max-height: calc(var(--full-height) * 1px) !important; }");
      }
    }
    return selector + block;
  });

  const urlTokens: string[] = [];
  css = css.replace(/url\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi, (url) => {
    urlTokens.push(url);
    return `READEST_URL_${urlTokens.length - 1}_PLACEHOLDER`;
  });
  css = css.replace(
    /((?:^|[{;\s])background(?:-attachment)?\s*:)([^;{}]*)/gi,
    (match, prop: string, value: string) => {
      if (!/\bfixed\b/i.test(value)) return match;
      const fns: string[] = [];
      const masked = value.replace(/[\w-]*\([^)]*\)/g, (fn) => {
        fns.push(fn);
        return `READEST_FN_${fns.length - 1}_PLACEHOLDER`;
      });
      const rewritten = masked.replace(/\bfixed\b/gi, "scroll");
      return prop + rewritten.replace(/READEST_FN_(\d+)_PLACEHOLDER/g, (_, i) => fns[+i]!);
    },
  );
  css = css.replace(/READEST_URL_(\d+)_PLACEHOLDER/g, (_, i) => urlTokens[+i]!);

  if (!vertical) {
    css = css.replace(ruleRegex, (match, selector, block: string) => {
      const bgValues = [
        ...block.matchAll(/(?:^|[^-a-z])background(?:-color|-image)?\s*:\s*([^;!}]+)/gi),
      ].map((m) => m[1]!.trim());
      const paints = bgValues.some(
        (v) =>
          !/^(?:none|transparent)$/i.test(v) &&
          !/^(?:rgba|hsla)\([^)]*[,\s]0(?:\.0+)?\s*\)$/i.test(v),
      );
      if (!paints) return match;
      let left = "";
      let right = "";
      for (const decl of block.matchAll(/(?:^|[^-a-z])margin(-left|-right)?\s*:\s*([^;!}]+)/gi)) {
        const side = decl[1];
        const value = decl[2]!.trim();
        if (side === "-left") {
          left = value;
        } else if (side === "-right") {
          right = value;
        } else {
          if (value.includes("(")) continue;
          const parts = value.split(/\s+/);
          if (parts.length < 1 || parts.length > 4) continue;
          const [top, r = top, , l = r] = parts;
          right = r!;
          left = l!;
        }
      }
      const overrides =
        (left.startsWith("-") ? " margin-left: 0 !important;" : "") +
        (right.startsWith("-") ? " margin-right: 0 !important;" : "");
      if (!overrides) return match;
      return selector + block.replace(/}$/, `${overrides} }`);
    });
  }

  css = css.replace(ruleRegex, (_, selector, block) => {
    if (/\bbody\b/i.test(selector)) {
      const hasSerifFont = /font-family\s*:\s*serif\s*(?:;|\}|$)/.test(block);
      const hasSansSerifFont = /font-family\s*:\s*sans-serif\s*(?:;|\}|$)/.test(block);
      if (hasSerifFont) {
        block = block.replace(/font-family\s*:\s*serif\s*(;|\}|$)/gi, "font-family: unset$1");
      }
      if (hasSansSerifFont) {
        block = block.replace(/font-family\s*:\s*sans-serif\s*(;|\}|$)/gi, "font-family: unset$1");
      }
    }
    return selector + block;
  });

  css = css.replace(ruleRegex, (match, selector, block) => {
    const widthMatch = /(?:^|[^a-z-])width\s*:\s*(\d+(?:\.\d+)?)px/.exec(block);
    const pxWidth = widthMatch ? parseFloat(widthMatch[1] ?? "0") : 0;
    if (pxWidth > vw && !/max-width\s*:/.test(block)) {
      block = block.replace(
        /}$/,
        " width: 100%; max-width: calc(var(--available-width) * 1px); box-sizing: border-box; }",
      );
      return selector + block;
    }
    return match;
  });

  const isLandscape = vw > vh;
  const always = "(min-width: 0px)";
  const never = "(min-width: 999999px)";
  const quoted: string[] = [];
  css = css.replace(/"[^"\n]*"|'[^'\n]*'/g, (value) => {
    quoted.push(value);
    return `READEST_STR_${quoted.length - 1}_PLACEHOLDER`;
  });
  css = css.replace(/@media[^{]*/gi, (prelude) =>
    prelude
      .replace(/\(\s*orientation\s*:\s*(landscape|portrait)\s*\)/gi, (_, mode: string) =>
        (mode.toLowerCase() === "landscape") === isLandscape ? always : never,
      )
      .replace(
        /\(\s*(min|max)-(width|height)\s*:\s*([^)]+?)\s*\)/gi,
        (feature, bound: string, axis: string, length: string) => {
          const px = /^(\d*\.?\d+)(?:px)?$/.exec(length);
          if (!px) return feature;
          const viewport = axis.toLowerCase() === "width" ? vw : vh;
          const bounds = parseFloat(px[1]!);
          return (bound.toLowerCase() === "min" ? viewport >= bounds : viewport <= bounds)
            ? always
            : never;
        },
      ),
  );
  css = css.replace(/READEST_STR_(\d+)_PLACEHOLDER/g, (_, i) => quoted[+i]!);

  css = css
    .replace(/font-size\s*:\s*xx-small/gi, "font-size: 0.6rem")
    .replace(/font-size\s*:\s*x-small/gi, "font-size: 0.75rem")
    .replace(/font-size\s*:\s*small/gi, "font-size: 0.875rem")
    .replace(/font-size\s*:\s*medium/gi, "font-size: 1rem")
    .replace(/font-size\s*:\s*large/gi, "font-size: 1.2rem")
    .replace(/font-size\s*:\s*x-large/gi, "font-size: 1.5rem")
    .replace(/font-size\s*:\s*xx-large/gi, "font-size: 2rem")
    .replace(/font-size\s*:\s*xxx-large/gi, "font-size: 3rem")
    .replace(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi, (_, px) => {
      const rem = parseFloat(px) / 16;
      return `font-size: ${rem}rem`;
    })
    .replace(/font-size\s*:\s*(\d+(?:\.\d+)?)pt/gi, (_, pt) => {
      const rem = parseFloat(pt) / 12;
      return `font-size: ${rem}rem`;
    })
    .replace(/font-size\s*:\s*(\d*\.?\d+)(px|rem|em|%)?/gi, (_, size, unit = "px") => {
      return `font-size: max(${size}${unit}, var(--min-font-size, 8px))`;
    })
    .replace(/backdrop-filter\s*:\s*brightness\(100%\)\s*[;]?/gi, "")
    .replace(/(\d*\.?\d+)vw/gi, (_, d) => (parseFloat(d) * vw) / 100 + "px")
    .replace(/(\d*\.?\d+)vh/gi, (_, d) => (parseFloat(d) * vh) / 100 + "px")
    .replace(/([\s;])-webkit-user-select\s*:\s*none/gi, "$1-webkit-user-select: unset")
    .replace(/([\s;])-moz-user-select\s*:\s*none/gi, "$1-moz-user-select: unset")
    .replace(/([\s;])-ms-user-select\s*:\s*none/gi, "$1-ms-user-select: unset")
    .replace(/([\s;])-o-user-select\s*:\s*none/gi, "$1-o-user-select: unset")
    .replace(/([\s;])user-select\s*:\s*none/gi, "$1user-select: unset")
    .replace(/(font-family\s*:\s*)([^;{}]*)/gi, (_match: string, prefix: string, value: string) => {
      const important = /\s*!\s*important\s*$/i.exec(value);
      const families = important ? value.slice(0, important.index) : value;
      const rewritten = families
        .split(",")
        .map((family: string) => {
          const generic = /^(serif|sans-serif|monospace)$/i.exec(family.trim());
          if (!generic) return family;
          const name = generic[1]!.toLowerCase();
          return family.replace(generic[1]!, `var(--${name}, ${name})`);
        })
        .join(",");
      return prefix + rewritten + (important ? important[0] : "");
    })
    .replace(/([\s;])font-weight\s*:\s*normal/gi, "$1font-weight: var(--font-weight)")
    .replace(/([\s;])color\s*:\s*black/gi, "$1color: var(--theme-fg-color)")
    .replace(/([\s;])color\s*:\s*#000000/gi, "$1color: var(--theme-fg-color)")
    .replace(/([\s;])color\s*:\s*#000/gi, "$1color: var(--theme-fg-color)")
    .replace(/([\s;])color\s*:\s*rgb\(0,\s*0,\s*0\)/gi, "$1color: var(--theme-fg-color)");

  return css;
};

// ---------------------------------------------------------------------------
// Per-document fixups (utils/style.ts apply* helpers)
// ---------------------------------------------------------------------------

const PREFIXED_ATTR_REGEX = /^([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)$/;
const EPUB_OPS_NAMESPACE = "http://www.idpf.org/2007/ops";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";

export const applyNamespacedAttributes = (doc: Document): void => {
  const lookupNamespace = (element: Element, prefix: string) => {
    for (let node: Element | null = element; node; node = node.parentElement) {
      const uri = node.getAttribute(`xmlns:${prefix}`);
      if (uri) return uri;
    }
    return null;
  };
  for (const element of doc.querySelectorAll("*")) {
    for (const { name, value } of Array.from(element.attributes)) {
      const [, prefix, localName] = PREFIXED_ATTR_REGEX.exec(name) ?? [];
      if (!prefix) continue;
      const uri =
        prefix === "xml"
          ? XML_NAMESPACE
          : (lookupNamespace(element, prefix) ?? (prefix === "epub" ? EPUB_OPS_NAMESPACE : null));
      if (uri && !element.hasAttributeNS(uri, localName!)) {
        element.setAttributeNS(uri, name, value);
      }
    }
  }
};

export const applyImageStyle = (doc: Document): void => {
  const win = doc.defaultView ?? window;
  const plans = Array.from(doc.querySelectorAll("img")).map((img) => {
    const widthAttr = img.getAttribute("width");
    const percentWidth =
      widthAttr && (widthAttr.endsWith("%") || widthAttr.endsWith("vw"))
        ? parseFloat(widthAttr)
        : NaN;
    const heightAttr = img.getAttribute("height");
    const percentHeight =
      heightAttr && (heightAttr.endsWith("%") || heightAttr.endsWith("vh"))
        ? parseFloat(heightAttr)
        : NaN;
    const noEnlarge = img.getAttribute("zy-enlarge-src") === "none";

    let inlineWithText = false;
    let keepBaseline = false;
    const parent = img.parentNode;
    if (parent && parent.nodeType === Node.ELEMENT_NODE) {
      const childNodes = Array.from(parent.childNodes);
      const hasTextSiblings = childNodes.some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      );
      const isInline = childNodes.every(
        (node) => node.nodeType !== Node.ELEMENT_NODE || (node as Element).tagName !== "BR",
      );
      inlineWithText = hasTextSiblings && isInline;
      if (inlineWithText) {
        const valign = win.getComputedStyle(img).verticalAlign;
        keepBaseline = valign === "" || valign === "baseline";
      }
    }
    return { img, percentWidth, percentHeight, inlineWithText, keepBaseline, noEnlarge };
  });

  for (const {
    img,
    percentWidth,
    percentHeight,
    inlineWithText,
    keepBaseline,
    noEnlarge,
  } of plans) {
    if (!isNaN(percentWidth)) {
      img.style.width = `${(percentWidth / 100) * window.innerWidth}px`;
      img.removeAttribute("width");
    }
    if (!isNaN(percentHeight)) {
      img.style.height = `${(percentHeight / 100) * window.innerHeight}px`;
      img.removeAttribute("height");
    }
    if (inlineWithText) {
      img.classList.add("has-text-siblings");
      if (keepBaseline) img.classList.add("has-text-siblings-baseline");
    }
    if (noEnlarge) {
      img.style.setProperty("pointer-events", "none");
    }
  }
  doc.querySelectorAll("hr").forEach((hr) => {
    const computedStyle = window.getComputedStyle(hr);
    if (computedStyle.backgroundImage && computedStyle.backgroundImage !== "none") {
      hr.classList.add("background-img");
    }
  });
};

export const keepTextAlignment = (doc: Document): void => {
  const win = doc.defaultView ?? window;
  const els = doc.querySelectorAll("div, p, blockquote, dd");
  const alignClasses = new Array<string | null>(els.length);
  for (let i = 0; i < els.length; i++) {
    const align = win.getComputedStyle(els[i]!).textAlign;
    if (align === "center") alignClasses[i] = "aligned-center";
    else if (align === "left") alignClasses[i] = "aligned-left";
    else if (align === "right") alignClasses[i] = "aligned-right";
    else if (align === "justify") alignClasses[i] = "aligned-justify";
    else alignClasses[i] = null;
  }
  for (let i = 0; i < els.length; i++) {
    const cls = alignClasses[i];
    if (cls) els[i]!.classList.add(cls);
  }
};

// libs/document.ts getDirection — vertical books flip the margins/measure.
export const getDirection = (doc: Document): { vertical: boolean; rtl: boolean } => {
  const { defaultView } = doc;
  if (!defaultView || !doc.body) return { vertical: false, rtl: false };
  const { direction } = defaultView.getComputedStyle(doc.body);
  let { writingMode } = defaultView.getComputedStyle(doc.body);
  if (!writingMode || writingMode === "horizontal-tb") {
    const firstChild = doc.body.querySelector(":scope > :not([cfi-inert])");
    if (firstChild) {
      const childStyle = defaultView.getComputedStyle(firstChild);
      if (childStyle.writingMode === "vertical-rl" || childStyle.writingMode === "vertical-lr") {
        writingMode = childStyle.writingMode;
      }
    }
  }
  const vertical = writingMode === "vertical-rl" || writingMode === "vertical-lr";
  const rtl =
    writingMode === "vertical-rl" ||
    doc.body.dir === "rtl" ||
    direction === "rtl" ||
    doc.documentElement.dir === "rtl";
  return { vertical, rtl };
};

// libs/document.ts getPageProgressionRTL — the writing-mode branch is gone:
// the reader always passes "auto" (the per-section direction is resolved
// separately by getDirection).
export const getPageProgressionRTL = (
  bookDir: string | undefined,
  documentRtl: boolean,
): boolean =>
  bookDir === "rtl" ? true : bookDir === "ltr" ? false : documentRtl;

// ---------------------------------------------------------------------------
// Fixed-layout section docs (utils/style.ts applyFixedlayoutStyles) — Segue is
// permanently light, so the theme branch collapses to the light constants and
// every e-ink / dark-mode / override knob is out.
// ---------------------------------------------------------------------------

// PDF pages are rendered by the app and take the theme colors; fixed-layout
// EPUB pages are authored by the book and keep their own paper (#5649).
const isAppRendered = (format?: string): boolean => !format || format === "PDF";

export const applyFixedlayoutStyles = (doc: Document, format?: string): void => {
  const appRendered = isAppRendered(format);
  const existing = doc.getElementById("fixed-layout-styles");
  if (existing) existing.remove();
  const style = doc.createElement("style");
  style.id = "fixed-layout-styles";
  style.textContent = `
    html {
      --theme-bg-color: #ffffff;
      --theme-fg-color: #1c1b18;
      --theme-primary-color: #5a6f85;
      color-scheme: light;
      /* Chrome for Android's text autosizing rescales line metrics and shifts
         absolutely positioned per-letter text in fixed-layout books (#5641). */
      -webkit-text-size-adjust: none;
      text-size-adjust: none;
    }
    body {
      position: relative;
      ${appRendered ? "background-color: var(--theme-bg-color);" : ""}
    }
    #canvas {
      display: inline-block;
      width: fit-content;
      height: fit-content;
      background-color: var(--theme-bg-color);
    }
    img.singlePage {
      position: relative;
    }
    /* An unsized <image> draws at its natural size, which is the page size,
       but a percentage-height svg in an auto-height block is only 150px tall
       and would clip it to a strip (#6530). */
    svg:not([viewBox]):has(> image:not([width])) {
      overflow: visible;
    }
  `;
  doc.head.appendChild(style);
};
