import type { HubBookmarkItem, JobAnalysisSummary } from '@/lib/api';

function normWs(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/**
 * True when two job bodies are likely the same posting (discovery vs stored analysis).
 * Conservative on length skew to avoid reusing a different role.
 */
export function jobDescriptionsLikelySame(stored: string, incoming: string): boolean {
  const a = normWs(stored);
  const b = normWs(incoming);
  if (a.length < 30 || b.length < 30) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length > b.length ? a : b;
  if (short.length < long.length * 0.55) return false;
  const head = short.slice(0, Math.min(900, short.length));
  return long.includes(head);
}

function titleCompanyKey(title: string, company: string): string {
  return `${title.trim().toLowerCase()}\u001f${company.trim().toLowerCase()}`;
}

function pickBestAnalysisRow(rows: JobAnalysisSummary[]): JobAnalysisSummary | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    if (a.isTailored !== b.isTailored) return a.isTailored ? -1 : 1;
    const ta = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
  return sorted[0] ?? null;
}

/**
 * Rows from `GET /jobs/analyses?jobListingId=` — pick best analysis id for this CV (tailored first).
 */
export function pickAnalysisIdForListing(rows: JobAnalysisSummary[], cvProfileId: string): string | null {
  const cv = cvProfileId.trim();
  if (!cv || rows.length === 0) return null;
  const scoped = rows.filter((a) => !a.cvProfileId?.trim() || a.cvProfileId.trim() === cv);
  const best = pickBestAnalysisRow(scoped);
  return best?.id?.trim() || null;
}

/**
 * Bookmark + title/company fallback when listing-scoped analyses did not return a usable row.
 */
export function resolveExistingJobAnalysisId(opts: {
  cvProfileId: string;
  discoveryJobId: string;
  title: string;
  company: string;
  analyses: JobAnalysisSummary[];
  bookmarks: HubBookmarkItem[];
}): string | null {
  const cv = opts.cvProfileId.trim();
  const key = titleCompanyKey(opts.title, opts.company);

  const fromBookmark = opts.bookmarks.find(
    (b) =>
      b.jobListingId === opts.discoveryJobId &&
      typeof b.jobAnalysisId === 'string' &&
      b.jobAnalysisId.trim().length > 0,
  );
  if (fromBookmark?.jobAnalysisId) {
    const aid = fromBookmark.jobAnalysisId.trim();
    const row = opts.analyses.find((a) => a.id === aid);
    if (!row) return aid;
    const rowCv = row.cvProfileId?.trim();
    if (!rowCv || rowCv === cv) return aid;
    return null;
  }

  const scoped = opts.analyses.filter((a) => {
    const aCv = a.cvProfileId?.trim();
    if (aCv && aCv !== cv) return false;
    return titleCompanyKey(a.title, a.company) === key;
  });

  const best = pickBestAnalysisRow(scoped);
  return best?.id?.trim() || null;
}
