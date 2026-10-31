import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

/** A4 width at 96 dpi, the width the editor lays the page out at. */
const PAGE_WIDTH_PX = 794;
/** Bottom margin on every page and top margin after page one, so text never touches the edge. */
const PAGE_MARGIN_MM = 10;

const ALWAYS_KEEP = /(^|[\s,>+~(])(:root|:host|html|body|\*)(?=$|[\s,:.[>+~)])/;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Selector without pseudo-classes/elements, so it can be tested with querySelector. Escaped
 * colons belong to class names (`.sm\:flex-row`) and stay.
 */
export function testableSelector(selector: string): string {
  return selector
    .replace(/(?<!\\)::?[a-zA-Z-]+(\((?:[^()]|\([^()]*\))*\))?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ruleMatches(rule: CSSStyleRule, root: HTMLElement): boolean {
  const text = rule.selectorText;
  if (ALWAYS_KEEP.test(text)) return true;
  return text.split(',').some((part) => {
    const sel = testableSelector(part);
    if (!sel || sel === '>' || sel === '&') return true;
    try {
      return root.matches(sel) || root.querySelector(sel) != null;
    } catch {
      return false;
    }
  });
}

/** Style rules used by the rendered CV, keeping @layer/@media/@supports wrappers and @property defaults. */
function collectRules(
  rules: CSSRuleList,
  root: HTMLElement,
  fontFaces: CSSFontFaceRule[],
): string {
  let out = '';
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSStyleRule) {
      if (ruleMatches(rule, root)) out += rule.cssText;
    } else if (rule instanceof CSSFontFaceRule) {
      fontFaces.push(rule);
    } else if (rule.cssText.startsWith('@property')) {
      // Tailwind's custom-property defaults (shadows, rings, transforms) live in @property rules.
      out += rule.cssText;
    } else if (rule instanceof CSSLayerStatementRule) {
      out += rule.cssText;
    } else if (rule instanceof CSSLayerBlockRule) {
      const inner = collectRules(rule.cssRules, root, fontFaces);
      if (inner) out += `@layer ${rule.name}{${inner}}`;
    } else if (rule instanceof CSSMediaRule) {
      if (
        /\bprint\b/.test(rule.conditionText) ||
        !/\bscreen\b/.test(rule.conditionText)
      ) {
        const inner = collectRules(rule.cssRules, root, fontFaces);
        if (inner) out += `@media ${rule.conditionText}{${inner}}`;
      }
    } else if (rule instanceof CSSSupportsRule) {
      const inner = collectRules(rule.cssRules, root, fontFaces);
      if (inner) out += `@supports ${rule.conditionText}{${inner}}`;
    }
  }
  return out;
}

function usedFontFamilies(root: HTMLElement): Set<string> {
  const names = new Set<string>();
  const elements = [
    root,
    ...Array.from(root.querySelectorAll<HTMLElement>('*')),
  ];
  for (const el of elements) {
    for (const name of getComputedStyle(el).fontFamily.split(',')) {
      names.add(
        name
          .trim()
          .replace(/^["']|["']$/g, '')
          .toLowerCase(),
      );
    }
  }
  return names;
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** @font-face rules for the fonts the CV uses, with the font files embedded (the PDF renderer has no network). */
async function embeddedFontFaces(
  faces: CSSFontFaceRule[],
  used: Set<string>,
): Promise<string> {
  const wanted = faces.filter((face) => {
    const family = face.style
      .getPropertyValue('font-family')
      .trim()
      .replace(/^["']|["']$/g, '')
      .toLowerCase();
    return used.has(family);
  });
  const blocks = await Promise.all(
    wanted.map(async (face) => {
      let css = face.cssText;
      const urls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map(
        (m) => m[1]!,
      );
      for (const url of urls) {
        if (url.startsWith('data:')) continue;
        const absolute = new URL(url, window.location.href).href;
        const data = await toDataUrl(absolute);
        if (data) css = css.split(url).join(data);
      }
      return css;
    }),
  );
  return blocks.join('');
}

const PX_PER_MM = 96 / 25.4;
/** Shrink at most this much (9.5pt text stays above 8.5pt) to avoid a near-empty last page. */
const MAX_FIT_SHRINK = 0.1;

/**
 * Sizes the page for print: measures the real content (ignoring the templates' full-page
 * min-height), shrinks slightly when it only just spills onto another page, and stretches the
 * full-page backgrounds to exactly fill the pages used. Page one has no top margin; later pages
 * have top and bottom margins.
 */
function fitToPages(page: HTMLElement): void {
  for (const mark of Array.from(
    page.querySelectorAll<HTMLElement>('[data-cv-watermark]'),
  )) {
    mark.style.display = 'none';
  }
  const fills = Array.from(
    page.querySelectorAll<HTMLElement>('[data-cv-page-fill]'),
  );
  for (const el of fills)
    el.style.setProperty('min-height', '0px', 'important');
  const height = page.scrollHeight;
  const outside = fills.map((el) => Math.max(0, height - el.offsetHeight));

  const first = (297 - PAGE_MARGIN_MM) * PX_PER_MM;
  const later = (297 - 2 * PAGE_MARGIN_MM) * PX_PER_MM;
  const capacity = (pages: number) => first + (pages - 1) * later - 2;
  let pages = 1;
  while (capacity(pages) < height) pages += 1;
  let zoom = 1;
  if (pages > 1 && height <= capacity(pages - 1) * (1 + MAX_FIT_SHRINK)) {
    pages -= 1;
    zoom = capacity(pages) / height;
    // Widen before zooming so the zoomed page still spans the full A4 width.
    page.style.width = `${PAGE_WIDTH_PX / zoom}px`;
    page.style.zoom = String(zoom);
  }
  const target = capacity(pages) / zoom;
  fills.forEach((el, i) => {
    el.style.setProperty(
      'min-height',
      `${Math.max(0, target - outside[i]!)}px`,
      'important',
    );
  });
}

const PRINT_CSS = `
@page { size: A4; margin: ${PAGE_MARGIN_MM}mm 0; }
@page :first { margin-top: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
[data-cv-watermark] { display: none !important; }
[id^="cv-preview-"]:not([data-entry-id]) { break-inside: auto !important; }
[data-entry-id], li, p { break-inside: avoid-page; }
[data-entry-id^="__section-title__"], h1, h2, h3 { break-after: avoid-page; }
`;

/**
 * Renders the CV exactly as the editor draws it (read-only) and returns a self-contained HTML
 * document — markup, the CSS it uses and embedded fonts — for the server to print to PDF.
 */
export async function buildCvPrintDocument(
  element: ReactElement,
): Promise<string> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_WIDTH_PX}px;pointer-events:none;opacity:0;`;
  const page = document.createElement('div');
  page.setAttribute('data-cv-print-root', '');
  page.style.width = `${PAGE_WIDTH_PX}px`;
  page.style.background = '#fff';
  host.appendChild(page);
  document.body.appendChild(host);
  const root = createRoot(page);
  try {
    flushSync(() => root.render(element));
    await nextFrame();
    await nextFrame();
    await document.fonts.ready;

    const fontFaces: CSSFontFaceRule[] = [];
    let css = '';
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      css += collectRules(rules, page, fontFaces);
    }
    fitToPages(page);
    const fonts = await embeddedFontFaces(fontFaces, usedFontFamilies(page));
    // AI-change highlights help while editing; they must never print.
    const markup = page.outerHTML.replace(
      /<u\b[^>]*class="[^"]*\bcv-change-marker\b[^"]*"[^>]*>([\s\S]*?)<\/u>/gi,
      '$1',
    );
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${fonts}</style><style>${css}</style><style>${PRINT_CSS}</style></head><body>${markup}</body></html>`;
  } finally {
    root.unmount();
    host.remove();
  }
}
