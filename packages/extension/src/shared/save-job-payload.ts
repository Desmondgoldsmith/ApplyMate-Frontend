import { canonicalJobViewUrl } from '@/shared/job-page-url';
import type { CheckResponse, ExtractedJob, SaveJobPayload } from '@/shared/types';

/** Build save payload for Job tab bookmark + logo fallback when score did not persist logo. */
export function buildSaveJobPayloadFromExtracted(job: ExtractedJob): SaveJobPayload {
  const sourceUrl = canonicalJobViewUrl(job.sourceUrl) ?? job.sourceUrl;

  return {
    title: job.title.trim(),
    ...(job.company?.trim() ? { company: job.company.trim() } : {}),
    ...(job.location?.trim() ? { location: job.location.trim() } : {}),
    ...(job.description?.trim() ? { description: job.description.trim() } : {}),
    ...(job.salary ? { salary: job.salary } : {}),
    ...(job.jobType ? { jobType: job.jobType } : {}),
    ...(job.experienceLevel ? { experienceLevel: job.experienceLevel } : {}),
    ...(job.postedDate ? { postedDate: job.postedDate } : {}),
    ...(job.logoCandidateUrl?.trim()
      ? { logoCandidateUrl: job.logoCandidateUrl.trim() }
      : {}),
    sourceUrl,
    sourceSite: job.sourceSite,
  };
}

export function shouldSyncLogoAfterAnalyze(
  job: ExtractedJob | null | undefined,
  check: CheckResponse | null | undefined,
): boolean {
  if (!job?.logoCandidateUrl?.trim()) return false;
  if (check?.companyLogoUrl?.trim()) return false;
  return true;
}
