import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Backend Phase 6A links use `/dashboard/job-analyzer?...`.
 * The real analyzer UI lives at `/dashboard/jobs/analyze` (JobsAnalyzeContent).
 * Forward query params so deep links still hydrate correctly.
 */
export default async function JobAnalyzerAliasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const qp = new URLSearchParams();

  const first = (v: string | string[] | undefined): string => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    return '';
  };

  const jobListingId = first(sp.jobListingId).trim();
  const jobAnalysisId = first(sp.jobAnalysisId).trim();
  const jobIdLegacy = first(sp.jobId).trim();
  const contextToken = first(sp.contextToken).trim();
  const openTailor = first(sp.openTailor).trim();
  const fresh = first(sp.new).trim();

  if (jobListingId) qp.set('jobListingId', jobListingId);
  const analysisKey = jobAnalysisId || jobIdLegacy;
  if (analysisKey) qp.set('jobId', analysisKey);
  if (contextToken) qp.set('contextToken', contextToken);
  if (openTailor) qp.set('openTailor', openTailor);
  if (fresh) qp.set('new', fresh);

  const suffix = qp.toString();
  redirect(`/dashboard/jobs/analyze${suffix ? `?${suffix}` : ''}`);
}
