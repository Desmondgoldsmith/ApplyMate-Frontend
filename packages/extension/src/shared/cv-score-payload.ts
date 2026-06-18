import { trimJobDescriptionForApi } from '@/shared/job-description-limits';
import { canonicalJobViewUrl, isLinkedInJobSearchUrl } from '@/shared/job-page-url';

/** Allowed fields for POST /extension/cv/score (CvScoreDto). */
export type CvScoreRequestPayload = {
  cvId: string;
  jobTitle: string;
  jobDescription: string;
  company?: string;
  jobAnalysisId?: string;
  sourceUrl?: string;
  sourceSite?: string;
  logoCandidateUrl?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cvScoreBlockReason(input: {
  cvId?: string | null;
  jobTitle?: string | null;
  jobDescription?: string | null;
  sourceUrl?: string | null;
}): string | null {
  if (!input.cvId?.trim()) {
    return 'Select a CV profile to analyze.';
  }
  if (!input.jobTitle?.trim()) {
    return 'Job title is required before analyzing.';
  }

  const description = input.jobDescription?.trim() ?? '';
  if (description.length === 0) {
    if (input.sourceUrl && isLinkedInJobSearchUrl(input.sourceUrl)) {
      return 'Open a single job posting to analyze — the full job description has not loaded yet.';
    }
    return 'A job description is required. Open the full job posting before analyzing.';
  }

  if (input.sourceUrl && isLinkedInJobSearchUrl(input.sourceUrl) && description.length < 80) {
    return 'Open a single job posting to analyze — wait for the description to load in the detail pane.';
  }

  return null;
}

export function buildCvScorePayload(input: {
  cvId: string;
  jobTitle: string;
  jobDescription: string;
  company?: string | null;
  jobAnalysisId?: string | null;
  sourceUrl?: string | null;
  sourceSite?: string | null;
  logoCandidateUrl?: string | null;
}): CvScoreRequestPayload {
  const payload: CvScoreRequestPayload = {
    cvId: input.cvId.trim(),
    jobTitle: input.jobTitle.trim().slice(0, 300),
    jobDescription: trimJobDescriptionForApi(input.jobDescription),
  };

  const company = input.company?.trim();
  if (company) {
    payload.company = company.slice(0, 300);
  }

  const jobAnalysisId = input.jobAnalysisId?.trim();
  if (jobAnalysisId && UUID_RE.test(jobAnalysisId)) {
    payload.jobAnalysisId = jobAnalysisId;
  }

  const sourceUrl = input.sourceUrl ? canonicalJobViewUrl(input.sourceUrl) : null;
  if (sourceUrl) {
    payload.sourceUrl = sourceUrl;
  }

  const sourceSite = input.sourceSite?.trim();
  if (sourceSite) {
    payload.sourceSite = sourceSite.slice(0, 100);
  }

  const logoCandidateUrl = input.logoCandidateUrl?.trim();
  if (logoCandidateUrl) {
    payload.logoCandidateUrl = logoCandidateUrl;
  }

  return payload;
}

export function formatCvScoreValidationError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Could not analyze this job. Check the job description and try again.';
  if (/jobdescription|job description/i.test(trimmed)) {
    return trimmed;
  }
  if (/should not exist|forbid/i.test(trimmed)) {
    return 'Invalid analyze request. Reload the extension and try again.';
  }
  return trimmed;
}
