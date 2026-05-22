/**
 * Human-readable strings for CV assistant diff UI.
 *
 * **Summary (`targetSection === 'summary'`) — backend contract (narrow diff):**
 * - `diff.before` / `diff.after` are slices like `{ summary: { text: string } }` (or legacy string `summary`).
 * - Top-level `diff.summary` on the API **response** is only the one-line change blurb (same as `diffSummary`);
 *   it is **not** CV body text — use `diff.after.summary.text` (via this helper) for the proposed paragraph.
 *
 * Other sections may still send larger before/after shapes until narrowed server-side.
 */

/** Mirrors backend `readCvDataSummaryText`: summary string whether `summary` is a string or `{ text }`. */
export function readCvDataSummaryText(cv: unknown): string {
  if (cv == null) return '';
  if (typeof cv === 'string') return cv;
  if (typeof cv !== 'object') return '';
  const o = cv as Record<string, unknown>;
  const s = o.summary;
  if (typeof s === 'string') return s;
  if (s && typeof s === 'object' && s !== null && 'text' in s) {
    const t = (s as { text?: unknown }).text;
    if (typeof t === 'string') return t;
  }
  return '';
}

function readTargetFromBlob(targetSection: string, blob: unknown, maxJson: number): string {
  const ts = targetSection.trim().toLowerCase();
  if (!ts) return '';
  if (ts === 'summary') {
    const fromSummary = readCvDataSummaryText(blob);
    if (fromSummary.trim()) return fromSummary;
  }
  if (blob == null) return '';
  if (typeof blob === 'string') return blob.length > maxJson ? `${blob.slice(0, maxJson)}…` : blob;
  if (typeof blob !== 'object') return String(blob);
  const o = blob as Record<string, unknown>;
  const direct = o[ts];
  if (typeof direct === 'string') return direct;
  if (direct != null && typeof direct === 'object') {
    if ('text' in (direct as object)) {
      const t = (direct as { text?: unknown }).text;
      if (typeof t === 'string') return t;
    }
    try {
      const j = JSON.stringify(direct, null, 2);
      return j.length > maxJson ? `${j.slice(0, maxJson)}…` : j;
    } catch {
      return '';
    }
  }
  if (ts === 'summary') {
    const again = readCvDataSummaryText(blob);
    if (again) return again;
  }
  try {
    const j = JSON.stringify(o, null, 2);
    return j.length > maxJson ? `${j.slice(0, maxJson)}…` : j;
  } catch {
    return '';
  }
}

export function assistantDiffDisplayStrings(
  targetSection: string,
  before: unknown,
  after: unknown,
  maxJson = 12000,
): { before: string; after: string } {
  return {
    before: readTargetFromBlob(targetSection, before, maxJson),
    after: readTargetFromBlob(targetSection, after, maxJson),
  };
}

export function assistantChangedFieldLabel(targetSection: string): string {
  const t = targetSection.trim().toLowerCase();
  if (t === 'summary') return 'Summary';
  if (!t) return 'Update';
  return t.charAt(0).toUpperCase() + t.slice(1);
}
