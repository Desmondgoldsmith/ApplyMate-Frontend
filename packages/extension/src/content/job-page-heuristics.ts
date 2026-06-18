import { getLinkedInDetailPane } from '@/content/linkedin-extractor';
import {
  getJobDetailRoot,
  isExcludedNonJobSiteUrl,
  looksLikeSplitViewJobListingPage,
} from '@/content/job-detail-scope';
import {
  isApplyMateAppUrl,
  isKnownJobBoardUrl,
  urlLooksLikeJobListing,
} from '@/shared/job-page-url';

const JOB_SIGNAL_PATTERN =
  /\b(responsibilities|requirements|qualifications|what you.ll do|about the role|job description|apply now|how to apply|benefits|experience required|we are looking for|you will|key duties|about the job|who you are)\b/i;

const NEGATIVE_PAGE_PATTERN =
  /\b(blog post|newsletter|press release|cookie policy|privacy policy|terms of service|shopping cart|sign in to continue|conversation with gemini|you said|gemini said|clear chat|new notebook|chatgpt|claude said)\b/i;

function heuristicRoot(doc: Document): Element | null {
  const url = doc.defaultView?.location.href ?? '';
  const detailRoot = getJobDetailRoot(doc, url);
  if (detailRoot) return detailRoot;
  if (url.includes('linkedin.com') && url.includes('/jobs/')) {
    return getLinkedInDetailPane(doc);
  }
  if (looksLikeSplitViewJobListingPage(url, doc)) return null;
  return doc.body;
}

export function pageHasJobPostingSignals(doc: Document = document): boolean {
  const url = doc.defaultView?.location.href ?? '';
  if (isExcludedNonJobSiteUrl(url)) return false;

  const root = heuristicRoot(doc);
  if (!root) return false;

  const text =
    (root instanceof HTMLElement ? root.innerText : null) ??
    root.textContent ??
    '';
  if (text.length < 350) return false;

  const keywordHits = text.match(new RegExp(JOB_SIGNAL_PATTERN.source, 'gi'))?.length ?? 0;
  if (keywordHits < 2) return false;

  const titleEl =
    root.querySelector('h1') ??
    root.querySelector('h2') ??
    root.querySelector('[data-automation-id="jobPostingHeader"]') ??
    root.querySelector('[class*="job-title"]') ??
    root.querySelector('[class*="posting-title"]');
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
  if (isExcludedNonJobSiteUrl(url)) return false;
  if (isKnownJobBoardUrl(url) || urlLooksLikeJobListing(url)) return true;
  return pageHasJobPostingSignals(doc);
}

export function shouldShowFloatingJobIcon(
  url: string,
  hasExtractedJob: boolean,
  doc: Document = document,
): boolean {
  if (isApplyMateAppUrl(url)) return false;
  if (isExcludedNonJobSiteUrl(url)) return false;
  if (hasExtractedJob) return true;
  if (isKnownJobBoardUrl(url)) return true;
  if (pageHasJobPostingSignals(doc)) return true;
  if (urlLooksLikeJobListing(url) && (doc.body?.innerText.length ?? 0) >= 500) return true;
  return false;
}
