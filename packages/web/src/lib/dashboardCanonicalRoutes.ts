/**
 * Canonical dashboard feature URLs (2.6). Legacy alias paths redirect with HTTP 301;
 * in-app code should only emit canonical paths below.
 */
export const DASHBOARD_ROUTES = {
  jobAnalyze: '/dashboard/jobs/analyze',
  jobs: '/dashboard/jobs',
  interview: '/dashboard/interview',
  /** Dashboard interview activity list (upcoming + prep cards). */
  interviewPrepList: '/dashboard/interview-prep',
  cv: '/dashboard/cv',
  followUpJobs: '/dashboard/follow-up-jobs',
} as const;

export function firstSearchParam(
  sp: URLSearchParams,
  key: string,
): string {
  return sp.get(key)?.trim() ?? '';
}

/** Legacy `/dashboard/job-analyzer` → `/dashboard/jobs/analyze` (preserves query). */
export function buildJobAnalyzerAliasRedirect(searchParams: URLSearchParams): string {
  const qp = new URLSearchParams();

  const jobListingId = firstSearchParam(searchParams, 'jobListingId');
  const jobAnalysisId = firstSearchParam(searchParams, 'jobAnalysisId');
  const jobIdLegacy = firstSearchParam(searchParams, 'jobId');
  const contextToken = firstSearchParam(searchParams, 'contextToken');
  const openTailor = firstSearchParam(searchParams, 'openTailor');
  const fresh = firstSearchParam(searchParams, 'new');

  if (jobListingId) qp.set('jobListingId', jobListingId);
  const analysisKey = jobAnalysisId || jobIdLegacy;
  if (analysisKey) qp.set('jobId', analysisKey);
  if (contextToken) qp.set('contextToken', contextToken);
  if (openTailor) qp.set('openTailor', openTailor);
  if (fresh) qp.set('new', fresh);

  const suffix = qp.toString();
  return `${DASHBOARD_ROUTES.jobAnalyze}${suffix ? `?${suffix}` : ''}`;
}

/** Legacy `/dashboard/job-hub` → `/dashboard/jobs` (or analyze / follow-up when applicable). */
export function buildJobHubAliasRedirect(searchParams: URLSearchParams): string {
  const followUps = firstSearchParam(searchParams, 'followUps');
  if (followUps) {
    return DASHBOARD_ROUTES.followUpJobs;
  }

  const jobId = firstSearchParam(searchParams, 'jobId');
  const jobAnalysisId = firstSearchParam(searchParams, 'jobAnalysisId');
  const applicationId = firstSearchParam(searchParams, 'applicationId');
  const bookmarkId = firstSearchParam(searchParams, 'bookmarkId');
  const jobListingId = firstSearchParam(searchParams, 'jobListingId');
  const jobKey = firstSearchParam(searchParams, 'jobKey');
  const tabRaw = firstSearchParam(searchParams, 'tab');
  const template = firstSearchParam(searchParams, 'template');
  const focus = firstSearchParam(searchParams, 'focus');
  const tailorSection = firstSearchParam(searchParams, 'tailorSection');
  const tab =
    tabRaw.toLowerCase() === 'email-templates' ? 'email-templates' : tabRaw;

  const analysisKey = jobId || jobAnalysisId;

  if (focus.toLowerCase() === 'tailor' && analysisKey) {
    const tailorQp = new URLSearchParams({ jobId: analysisKey, openTailor: '1' });
    if (tailorSection) tailorQp.set('tailorSection', tailorSection);
    return `${DASHBOARD_ROUTES.jobAnalyze}?${tailorQp.toString()}`;
  }

  const qp = new URLSearchParams();
  if (analysisKey) qp.set('jobId', analysisKey);
  if (applicationId) qp.set('applicationId', applicationId);
  if (bookmarkId) qp.set('bookmarkId', bookmarkId);
  if (jobListingId) qp.set('jobListingId', jobListingId);
  if (jobKey) qp.set('jobKey', jobKey);
  if (tab) qp.set('tab', tab);
  if (template) qp.set('template', template);
  if (focus) qp.set('focus', focus);

  const suffix = qp.toString();
  return `${DASHBOARD_ROUTES.jobs}${suffix ? `?${suffix}` : ''}`;
}

/** Legacy `/dashboard/interviews` → `/dashboard/interview-prep` list (preserves query). */
export function buildInterviewsAliasRedirect(searchParams: URLSearchParams): string {
  const qp = new URLSearchParams();
  searchParams.forEach((value, key) => {
    const val = value.trim();
    if (val) qp.set(key, val);
  });
  const suffix = qp.toString();
  return `${DASHBOARD_ROUTES.interviewPrepList}${suffix ? `?${suffix}` : ''}`;
}

/** Rewrite legacy dashboard alias paths to canonical URLs (in-app links & notifications). */
export function normalizeDashboardRoute(href: string): string {
  const trimmed = href.trim();
  if (!trimmed.startsWith('/')) return trimmed;

  try {
    const u = new URL(trimmed, 'https://applymate.local');
    const path = u.pathname.replace(/\/$/, '') || '/';

    if (path === '/dashboard/job-analyzer') {
      const dest = buildJobAnalyzerAliasRedirect(u.searchParams);
      const destUrl = new URL(dest, 'https://applymate.local');
      return `${destUrl.pathname}${destUrl.search}${u.hash}`;
    }

    if (path === '/dashboard/job-hub') {
      const dest = buildJobHubAliasRedirect(u.searchParams);
      const destUrl = new URL(dest, 'https://applymate.local');
      return `${destUrl.pathname}${destUrl.search}${u.hash}`;
    }

    if (path === '/dashboard/interviews') {
      const dest = buildInterviewsAliasRedirect(u.searchParams);
      const destUrl = new URL(dest, 'https://applymate.local');
      return `${destUrl.pathname}${destUrl.search}${u.hash}`;
    }

    if (path === '/dashboard/cv-clinic') {
      u.pathname = DASHBOARD_ROUTES.cv;
      return `${u.pathname}${u.search}${u.hash}`;
    }

    if (path === '/dashboard/job-archive' || path === '/dashboard/jobs/archived') {
      u.pathname = '/dashboard/jobs/archive';
      return `${u.pathname}${u.search}${u.hash}`;
    }

    /** Backend quiet-app CTAs: `/dashboard/jobs/{applicationId}` → query form Job Hub expects. */
    const jobsAppPath = path.match(/^\/dashboard\/jobs\/([^/]+)$/);
    if (jobsAppPath?.[1] && !u.searchParams.has('applicationId') && !u.searchParams.has('jobId')) {
      u.pathname = DASHBOARD_ROUTES.jobs;
      u.searchParams.set('applicationId', jobsAppPath[1]);
      return `${u.pathname}${u.search}${u.hash}`;
    }

    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return trimmed;
  }
}

export function jobHubAnalysisHref(jobAnalysisId: string, focus = 'analysis'): string {
  const qp = new URLSearchParams();
  qp.set('jobId', jobAnalysisId);
  if (focus) qp.set('focus', focus);
  return `${DASHBOARD_ROUTES.jobs}?${qp.toString()}`;
}

export function jobHubApplicationHref(applicationId: string): string {
  const qp = new URLSearchParams({ applicationId, focus: 'followup' });
  return `${DASHBOARD_ROUTES.jobs}?${qp.toString()}`;
}

export function jobHubBookmarkHref(bookmarkId: string): string {
  return `${DASHBOARD_ROUTES.jobs}?${new URLSearchParams({ bookmarkId }).toString()}`;
}

export function interviewPrepHref(jobAnalysisId: string): string {
  return `${DASHBOARD_ROUTES.interview}?${new URLSearchParams({
    jobAnalysisId,
  }).toString()}`;
}
