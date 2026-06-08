import {
  isApplyMateAppUrl,
  isKnownJobBoardUrl,
  urlLooksLikeJobListing,
} from '@/shared/job-page-url';

const JOB_SIGNAL_PATTERN =
  /\b(responsibilities|requirements|qualifications|what you.ll do|about the role|job description|apply now|how to apply|benefits|experience required|we are looking for|you will|key duties|about the job|who you are)\b/i;

const NEGATIVE_PAGE_PATTERN =
  /\b(blog post|newsletter|press release|cookie policy|privacy policy|terms of service|shopping cart|sign in to continue)\b/i;

export function pageHasJobPostingSignals(doc: Document = document): boolean {
  const body = doc.body;
  if (!body) return false;

  const text = body.innerText ?? '';
  if (text.length < 350) return false;

  const keywordHits = text.match(new RegExp(JOB_SIGNAL_PATTERN.source, 'gi'))?.length ?? 0;
  if (keywordHits < 2) return false;

  const titleEl =
    doc.querySelector('h1') ??
    doc.querySelector('[data-automation-id="jobPostingHeader"]') ??
    doc.querySelector('[class*="job-title"]') ??
    doc.querySelector('[class*="posting-title"]');
  const title = titleEl?.textContent?.trim() ?? '';
  if (title.length < 3 || title.length > 180) return false;

  const combined = `${doc.title}\n${text.slice(0, 1200)}`;
  if (NEGATIVE_PAGE_PATTERN.test(combined) && keywordHits < 4) return false;

  return true;
}

/** @deprecated alias */
export function pageHasSingleJobPostingSignals(doc: Document = document): boolean {
  return pageHasJobPostingSignals(doc);
}

export function shouldMonitorPageForJob(url: string, doc: Document = document): boolean {
  if (isApplyMateAppUrl(url)) return false;
  if (isKnownJobBoardUrl(url) || urlLooksLikeJobListing(url)) return true;
  return pageHasJobPostingSignals(doc);
}

export function shouldShowFloatingJobIcon(
  url: string,
  hasExtractedJob: boolean,
  doc: Document = document,
): boolean {
  if (isApplyMateAppUrl(url)) return false;
  if (hasExtractedJob) return true;
  if (isKnownJobBoardUrl(url)) return true;
  if (pageHasJobPostingSignals(doc)) return true;
  if (urlLooksLikeJobListing(url) && (doc.body?.innerText.length ?? 0) >= 500) return true;
  return false;
}
