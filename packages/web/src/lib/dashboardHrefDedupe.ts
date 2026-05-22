/** Normalize dashboard links for dedupe (pathname + search; ignores origin). */
export function canonicalDashboardHref(href: string): string {
  const h = href.trim();
  if (!h) return '';
  try {
    const u = /^https?:\/\//i.test(h) ? new URL(h) : new URL(h, 'https://applymate.invalid');
    return `${u.pathname}${u.search}`;
  } catch {
    return h.startsWith('/') ? h : `/${h}`;
  }
}

export function buildDashboardCtaHrefSet(hrefs: Array<string | null | undefined>): Set<string> {
  const s = new Set<string>();
  for (const h of hrefs) {
    const c = canonicalDashboardHref(String(h ?? '').trim());
    if (c) s.add(c);
  }
  return s;
}
