/** Shared rich-text sanitize + display for CV builder, inline preview, and export preview. */

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
