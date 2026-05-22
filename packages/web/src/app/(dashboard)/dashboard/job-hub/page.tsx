import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/**
 * Backend Phase 6A may link to `/dashboard/job-hub?...`.
 * The Jobs hub UI lives at `/dashboard/jobs` (JobHub).
 * Forward query params and normalize `jobAnalysisId` → `jobId` (what JobHub reads).
 */
export default async function JobHubAliasPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;

  const followUps = first(sp.followUps).trim();
  if (followUps) {
    redirect('/dashboard/follow-up-jobs');
  }

  const qp = new URLSearchParams();

  const jobId = first(sp.jobId).trim();
  const jobAnalysisId = first(sp.jobAnalysisId).trim();
  const applicationId = first(sp.applicationId).trim();
  const bookmarkId = first(sp.bookmarkId).trim();
  const jobListingId = first(sp.jobListingId).trim();
  const jobKey = first(sp.jobKey).trim();
  const tabRaw = first(sp.tab).trim();
  const template = first(sp.template).trim();
  const focus = first(sp.focus).trim();
  const tailorSection = first(sp.tailorSection).trim();
  const tab =
    tabRaw.toLowerCase() === 'email-templates' ? 'email-templates' : tabRaw;

  const analysisKey = jobId || jobAnalysisId;

  if (focus.toLowerCase() === 'tailor' && analysisKey) {
    const tailorQp = new URLSearchParams({ jobId: analysisKey, openTailor: '1' });
    if (tailorSection) tailorQp.set('tailorSection', tailorSection);
    redirect(`/dashboard/jobs/analyze?${tailorQp.toString()}`);
  }
  if (analysisKey) qp.set('jobId', analysisKey);
  if (applicationId) qp.set('applicationId', applicationId);
  if (bookmarkId) qp.set('bookmarkId', bookmarkId);
  if (jobListingId) qp.set('jobListingId', jobListingId);
  if (jobKey) qp.set('jobKey', jobKey);
  if (tab) qp.set('tab', tab);
  if (template) qp.set('template', template);
  if (focus) qp.set('focus', focus);

  const suffix = qp.toString();
  redirect(`/dashboard/jobs${suffix ? `?${suffix}` : ''}`);
}
