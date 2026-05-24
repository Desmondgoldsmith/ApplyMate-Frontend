/** Normalize for loose string comparison (headings, dedupe). */
function normLoose(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ');
}

/**
 * True when the small-caps eyebrow and the headline repeat the same idea
 * (e.g. "Where Things Stand" + "Where things stand right now").
 */
export function pipelineEyebrowHeadlineRedundant(
  eyebrow: string,
  headline: string,
): boolean {
  const e = normLoose(eyebrow);
  const h = normLoose(headline);
  if (!e || !h) return false;
  if (h === e) return true;
  if (h.startsWith(e) && h.length - e.length <= 28) return true;
  if (e.startsWith(h) && e.length - h.length <= 28) return true;
  const stem = 'where things stand';
  if (
    e.includes(stem) &&
    h.includes(stem) &&
    Math.abs(e.length - h.length) <= 28
  )
    return true;
  return false;
}

/** Merge pipeline + landscape bodies without repeating identical or nested blocks. */
export function mergePipelineLandscapeBodies(
  a: string | null,
  b: string | null,
): string | null {
  const pa = a?.trim() ?? '';
  const pb = b?.trim() ?? '';
  if (!pa) return pb || null;
  if (!pb) return pa;
  if (pa === pb) return pa;
  const na = normLoose(pa);
  const nb = normLoose(pb);
  if (na === nb) return pa;
  if (na.includes(nb) || nb.includes(na))
    return pa.length >= pb.length ? pa : pb;
  return `${pa}\n\n${pb}`;
}

/**
 * Drop sentences that largely repeat an earlier one (merged copy / backend glitches).
 */
/** Drop headline when body already contains the same narrative (backend duplicate glitches). */
export function pipelineHeadlineSubsumedByBody(
  headline: string | null,
  body: string | null,
): boolean {
  const h = normLoose(headline ?? '');
  const b = normLoose(body ?? '');
  if (!h || !b) return false;
  if (h === b) return true;
  if (b.includes(h) && h.length >= 24) return true;
  if (h.includes(b) && b.length >= 24) return true;
  const prefixLen = Math.min(36, h.length, b.length);
  if (prefixLen >= 16 && h.slice(0, prefixLen) === b.slice(0, prefixLen))
    return true;
  return pipelineEyebrowHeadlineRedundant(h, b);
}

export function dedupeNearDuplicateSentences(text: string): string {
  const raw = text.trim();
  if (!raw) return raw;
  const paragraphs = raw
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const mergedParagraphs = paragraphs.map((para) => {
    const chunks = para
      .split(/(?<=[.!?])\s+/)
      .map((c) => c.trim())
      .filter(Boolean);
    const kept: string[] = [];
    for (const c of chunks) {
      const low = normLoose(c);
      const prefixLen = Math.min(40, low.length);
      const prefix = low.slice(0, prefixLen);
      const dup = kept.some((prev) => {
        const pl = normLoose(prev);
        if (pl === low) return true;
        if (prefixLen >= 12 && pl.slice(0, prefixLen) === prefix) return true;
        if (
          prefixLen >= 20 &&
          (pl.includes(prefix) || low.includes(pl.slice(0, prefixLen)))
        )
          return true;
        return false;
      });
      if (!dup) kept.push(c);
    }
    return kept.join(' ');
  });
  if (mergedParagraphs.length <= 1) return mergedParagraphs.join('\n\n');
  const out: string[] = [];
  for (const p of mergedParagraphs) {
    const n = normLoose(p);
    const subsumed = out.some((prev) => {
      const pn = normLoose(prev);
      return (
        n === pn ||
        (n.length >= 40 && pn.includes(n.slice(0, 40))) ||
        (pn.length >= 40 && n.includes(pn.slice(0, 40)))
      );
    });
    if (!subsumed) out.push(p);
  }
  return out.join('\n\n');
}
