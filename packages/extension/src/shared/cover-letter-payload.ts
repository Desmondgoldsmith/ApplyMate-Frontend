import { canonicalJobViewUrl, isLinkedInJobSearchUrl } from '@/shared/job-page-url';

/** Allowed fields for POST /extension/cover-letter. */
export type CoverLetterRequestPayload = {
  cvId: string;
  jobTitle: string;
  jobDescription: string;
  company: string;
  jobLocation?: string;
  jobType?: string;
  jobAnalysisId?: string;
  sourceUrl?: string;
  sourceSite?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function coverLetterBlockReason(input: {
  cvId?: string | null;
  jobTitle?: string | null;
  jobDescription?: string | null;
  company?: string | null;
  sourceUrl?: string | null;
}): string | null {
  if (!input.cvId?.trim()) {
    return 'Select a CV profile first.';
  }
  if (!input.jobTitle?.trim()) {
    return 'Job title is required before generating a cover letter.';
  }
  if (!input.company?.trim()) {
    return 'Company name is required before generating a cover letter.';
  }

  const description = input.jobDescription?.trim() ?? '';
  if (description.length === 0) {
    if (input.sourceUrl && isLinkedInJobSearchUrl(input.sourceUrl)) {
      return 'Open a single job posting — the full job description has not loaded yet.';
    }
    return 'A job description is required. Open the full job posting first.';
  }

  return null;
}

export function buildCoverLetterPayload(input: {
  cvId: string;
  jobTitle: string;
  jobDescription: string;
  company: string;
  jobLocation?: string | null;
  jobType?: string | null;
  jobAnalysisId?: string | null;
  sourceUrl?: string | null;
  sourceSite?: string | null;
}): CoverLetterRequestPayload {
  const payload: CoverLetterRequestPayload = {
    cvId: input.cvId.trim(),
    jobTitle: input.jobTitle.trim().slice(0, 300),
    jobDescription: input.jobDescription.trim(),
    company: input.company.trim().slice(0, 300),
  };

  const jobLocation = input.jobLocation?.trim();
  if (jobLocation) {
    payload.jobLocation = jobLocation.slice(0, 300);
  }

  const jobType = input.jobType?.trim();
  if (jobType) {
    payload.jobType = jobType.slice(0, 100);
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

  return payload;
}

export function formatCoverLetterValidationError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 'Could not generate cover letter. Check the job details and try again.';
  }
  if (/should not exist|forbid|property action/i.test(trimmed)) {
    return 'Invalid cover letter request. Reload the extension and try again.';
  }
  return trimmed;
}
