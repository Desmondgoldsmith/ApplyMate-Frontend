/** Shared rich-text sanitize + display for CV builder, inline preview, and export preview. */

export function containsCvChangeMarker(raw: string): boolean {
  return (
    /<u\b[^>]*class=["'][^"']*\bcv-change-marker\b[^"']*["'][^>]*>/i.test(raw) ||
    /&lt;u\b[^&]*cv-change-marker/i.test(raw)
  );
}

/** Strip tailor builder markers before client-side export preview (server export strips too). */
export function stripCvChangeMarkers(raw: string): string {
  return raw
    .replace(/<u\b[^>]*class=["'][^"']*\bcv-change-marker\b[^"']*["'][^>]*>/gi, '')
    .replace(/<\/u>/gi, '');
}

/** Plain label for comma-separated skills input — does not mutate stored HTML. */
export function skillLabelForCommaField(raw: string): string {
  return richTextPlainText(raw) || raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Commit comma-separated skills while preserving tailor marker HTML on unchanged skills. */
export function resolveSkillsFromCommaInput(raw: string, previous: string[]): string[] {
  const segments = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const pool = [...previous];
  const next: string[] = [];
  for (const seg of segments) {
    const matchIdx = pool.findIndex(
      (skill) => skillLabelForCommaField(skill).toLowerCase() === seg.toLowerCase(),
    );
    if (matchIdx >= 0) {
      next.push(pool.splice(matchIdx, 1)[0]!);
    } else {
      next.push(seg);
    }
  }
  return next.length > 0 ? next : [''];
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeHtml(input: string): string {
  if (typeof document === 'undefined') return input;
  const txt = document.createElement('textarea');
  txt.innerHTML = input;
  return txt.value;
}

export function sanitizeRichHtml(input: string): string {
  if (typeof document === 'undefined') return input;
  const root = document.createElement('div');
  root.innerHTML = input;
  const allowed = new Set(['STRONG', 'EM', 'U', 'BR', 'A']);

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (tag === 'BR') return '<br/>';
    if (tag === 'U') {
      const classes = (el.getAttribute('class') ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const classAttr = classes.includes('cv-change-marker') ? ' class="cv-change-marker"' : '';
      const children = Array.from(el.childNodes).map(walk).join('');
      return `<u${classAttr}>${children}</u>`;
    }
    if (tag === 'A') {
      const rawHref = (el.getAttribute('href') ?? '').trim();
      const safeHref =
        rawHref.startsWith('http://') || rawHref.startsWith('https://') ? rawHref : '';
      const children = Array.from(el.childNodes).map(walk).join('');
      if (!safeHref) return children;
      return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noreferrer">${children}</a>`;
    }
    const children = Array.from(el.childNodes).map(walk).join('');
    if (allowed.has(tag)) return `<${tag.toLowerCase()}>${children}</${tag.toLowerCase()}>`;
    if (tag === 'DIV' || tag === 'P') return `${children}<br/>`;
    return children;
  };

  return Array.from(root.childNodes).map(walk).join('').replace(/(<br\/>)+$/g, '').trim();
}

/** Canonical storage form from a contenteditable field's innerHTML. */
export function normalizeEditableHtml(input: string): string {
  const canonical = input
    .replace(/<b(\s[^>]*)?>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>')
    .replace(/<i(\s[^>]*)?>/gi, '<em>')
    .replace(/<\/i>/gi, '</em>')
    .replace(/<div><br><\/div>/gi, '\n')
    .replace(/<div>/gi, '\n')
    .replace(/<\/div>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return sanitizeRichHtml(canonical);
}

const ENTITY_ANCHOR_RE =
  /&lt;a\s+href=&quot;(.*?)&quot;(?:\s[^&]*)?&gt;(.*?)&lt;\/a&gt;/gi;
const RAW_ANCHOR_RE = /<a\s+href=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/a>/gi;

function expandAnchors(input: string): string {
  const fromEntities = input.replace(
    ENTITY_ANCHOR_RE,
    '<a href="$1" target="_blank" rel="noreferrer">$2</a>',
  );
  return fromEntities.replace(
    RAW_ANCHOR_RE,
    '<a href="$1" target="_blank" rel="noreferrer">$2</a>',
  );
}

/** Safe HTML for contenteditable display and CV preview (preserves links). */
export function toDisplayRichHtml(input: string): string {
  const decoded = decodeHtml(input);
  const withUnderline = decoded.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>');
  const withStrong = withUnderline.replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, '<strong>$1</strong>');
  const withEm = withStrong.replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/g, '<em>$1</em>');
  const withAnchors = expandAnchors(withEm);
  const withMdBold = withAnchors.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const withMdItalic = withMdBold.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');
  return sanitizeRichHtml(withMdItalic.replace(/\n/g, '<br/>'));
}

/** Visible plain text for emptiness checks (filters, section visibility). */
export function richTextPlainText(input: string): string {
  if (!input?.trim()) return '';
  if (typeof document === 'undefined') {
    return decodeHtml(input)
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const el = document.createElement('div');
  el.innerHTML = toDisplayRichHtml(input);
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}
