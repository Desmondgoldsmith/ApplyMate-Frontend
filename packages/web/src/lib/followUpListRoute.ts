/** Dedicated follow-up queue page (not Job Hub). */
export const FOLLOW_UP_JOBS_PAGE_HREF = '/dashboard/follow-up-jobs';

/**
 * Prefer the dedicated follow-up page. Remaps legacy `?followUps=1` links on Job Hub / Job list
 * so “Show all” always opens the standalone queue UI.
 */
export function resolveFollowUpJobsListHref(backendHref: string | null | undefined): string {
  const raw = (backendHref ?? '').trim();
  if (!raw) return FOLLOW_UP_JOBS_PAGE_HREF;

  try {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const u = new URL(raw);
      const fu = u.searchParams.get('followUps') ?? u.searchParams.get('follow_ups');
      const path = u.pathname.toLowerCase();
      if (fu && (path.includes('/job-hub') || path.endsWith('/jobs'))) {
        return FOLLOW_UP_JOBS_PAGE_HREF;
      }
      return raw;
    }
  } catch {
    /* keep raw */
  }

  const lower = raw.toLowerCase();
  if (
    (lower.includes('/job-hub') || lower.includes('/jobs')) &&
    (lower.includes('followups=1') || lower.includes('follow_ups=1'))
  ) {
    return FOLLOW_UP_JOBS_PAGE_HREF;
  }
  return raw;
}
