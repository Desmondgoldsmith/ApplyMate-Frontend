const URL_LIKE = /^https?:\/\//i;

const BLOCKED_HOST_SUFFIXES = ['applymate.app', 'applymate.local', 'localhost', '127.0.0.1', '0.0.0.0'];

const BLOCKED_PATH_PREFIXES = ['/dashboard', '/jobs/analyze', '/login', '/register'];

/** Keys accepted by POST /jobs/analyze (first valid wins). */
const APPLY_URL_RECORD_KEYS = [
  'applyUrl',
  'apply_url',
  'jobUrl',
  'job_url',
  'jobPostingUrl',
  'job_posting_url',
  'postingUrl',
  'posting_url',
  'applicationUrl',
  'application_url',
  'sourceUrl',
  'source_url',
  'url',
] as const;

export function isValidExternalApplyUrl(url: string | null | undefined): url is string {
  const t = url?.trim();
  if (!t || !URL_LIKE.test(t)) return false;
  try {
    const u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

    const host = u.hostname.toLowerCase();
    if (BLOCKED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))) return false;

    const path = u.pathname.toLowerCase();
    if (BLOCKED_PATH_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false;

    return true;
  } catch {
    return false;
  }
}

export function pickApplyUrlFromRecord(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw) return null;
  for (const key of APPLY_URL_RECORD_KEYS) {
    const v = raw[key];
    if (typeof v === 'string' && isValidExternalApplyUrl(v)) return v.trim();
  }
  return null;
}

/** Body fragment for POST /jobs/analyze when a posting URL is known. */
export function applyUrlAnalyzePayload(url: string | null | undefined): { applyUrl?: string } {
  if (!isValidExternalApplyUrl(url)) return {};
  return { applyUrl: url.trim() };
}
