import type { CVSectionRecord, CVProfile } from '@/lib/api';

function collectStrings(v: unknown, out: string[], depth = 0): void {
  if (depth > 12) return;
  if (v == null) return;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t.length > 1) out.push(t);
    return;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    out.push(String(v));
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) collectStrings(x, out, depth + 1);
    return;
  }
  if (typeof v === 'object') {
    for (const x of Object.values(v as Record<string, unknown>)) collectStrings(x, out, depth + 1);
  }
}

/** Flatten CV profile + section rows into one lowercase blob for keyword overlap. */
export function buildCvCorpusForMatch(profile: CVProfile | undefined, sections: CVSectionRecord[]): string {
  const chunks: string[] = [];
  if (profile?.headline) chunks.push(profile.headline);
  if (profile?.location) chunks.push(profile.location);
  if (profile?.rawText) chunks.push(profile.rawText);
  if (profile?.structured) collectStrings(profile.structured, chunks);
  for (const s of sections) {
    collectStrings(s.data, chunks);
  }
  return chunks.join(' \n ').toLowerCase();
}

const STOP = new Set([
  'with',
  'that',
  'this',
  'from',
  'have',
  'will',
  'your',
  'their',
  'they',
  'them',
  'what',
  'when',
  'where',
  'which',
  'while',
  'about',
  'into',
  'than',
  'then',
  'there',
  'these',
  'those',
  'very',
  'also',
  'just',
  'more',
  'most',
  'some',
  'such',
  'only',
  'other',
  'been',
  'being',
  'both',
  'each',
  'made',
  'many',
  'must',
  'same',
  'work',
  'years',
  'year',
  'team',
  'role',
  'job',
  'jobs',
]);

/**
 * Rough overlap score (0–100) between CV corpus tokens and job text — not ATS grade;
 * used only when the discovery API does not send `matchScore`.
 */
export function computeCvJobMatchPreview(cvCorpus: string, jobTitle: string, jobDescription: string): number {
  const jobBlob = `${jobTitle}\n${jobDescription}`.toLowerCase();
  const rawTokens = cvCorpus.match(/\b[a-z][a-z0-9+.#]{2,}\b/g) ?? [];
  const tokens = [...new Set(rawTokens)].filter((t) => t.length >= 3 && !STOP.has(t));
  if (tokens.length === 0) return 12;
  let hits = 0;
  for (const t of tokens) {
    if (jobBlob.includes(t)) hits += 1;
  }
  const ratio = hits / Math.min(tokens.length, 80);
  const score = Math.round(Math.min(94, Math.max(10, ratio * 130)));
  return score;
}
