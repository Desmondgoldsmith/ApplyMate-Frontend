/**
 * Resolve the DOM root for the *currently open* job on split-view boards (LinkedIn search,
 * Indeed SERP, etc.) and block URLs that should never be treated as job postings.
 */

import { getLinkedInDetailPane } from '@/content/linkedin-extractor';

const NON_JOB_SITE_HOSTS = [
  'gemini.google.com',
  'bard.google.com',
  'chat.openai.com',
  'chatgpt.com',
  'claude.ai',
  'copilot.microsoft.com',
  'perplexity.ai',
  'poe.com',
  'character.ai',
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'docs.google.com',
  'notion.so',
  'slack.com',
  'discord.com',
] as const;

/** Left-hand results column only — do NOT use `.jobs-search-results` (wraps the whole page). */
const LINKEDIN_LIST_ANCESTORS = [
  '.scaffold-layout__list',
  '.jobs-search-results-list',
  '[data-view-name="job-search-results-list"]',
].join(', ');

const LINKEDIN_DETAIL_COLUMN_SELECTORS = [
  '.jobs-search__job-details--container',
  '.jobs-search__job-details',
  '.scaffold-layout__detail',
  '.jobs-details',
  '[data-view-name="job-details"]',
  '.jobs-details__main-content',
  '.job-view-layout',
] as const;

const LINKEDIN_ANCHOR_SELECTORS = [
  '.jobs-description__content',
  '.jobs-description-content__container',
  '.job-details-jobs-unified-top-card__job-title',
  '.jobs-unified-top-card__job-title',
  '[class*="jobs-unified-top-card"]',
  'div.jobs-description',
  '.jobs-details-top-card',
] as const;

const LINKEDIN_DETAIL_SIGNALS = [
  '.job-details-jobs-unified-top-card__job-title',
  '.jobs-unified-top-card__job-title',
  '.jobs-description__content',
  '.jobs-description-content__container',
  'div.jobs-description',
  '.jobs-details-top-card',
  'h1',
  'h2',
].join(', ');

const INDEED_DETAIL_ROOT_SELECTORS = [
  '#jobsearch-ViewjobPaneWrapper',
  '.jobsearch-RightPane',
  '.jobsearch-JobComponent',
  '[data-testid="jobsearch-ViewjobPaneWrapper"]',
] as const;

const INDEED_DETAIL_SIGNALS = [
  '#jobDescriptionText',
  '[data-testid="jobsearch-JobInfoHeader-title"]',
  'h1.jobsearch-JobInfoHeader-title',
].join(', ');

const GENERIC_DETAIL_ROOT_SELECTORS = [
  '[data-job-description]',
  '[data-automation-id="jobPostingDescription"]',
  '[class*="job-detail"]',
  '[class*="JobDetail"]',
  '[id*="job-detail"]',
  '[class*="posting-detail"]',
] as const;

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isExcludedNonJobSiteUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.replace(/^www\./, '');
  return NON_JOB_SITE_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`),
  );
}

export function isInsideLinkedInListPane(el: Element): boolean {
  return Boolean(el.closest(LINKEDIN_LIST_ANCESTORS));
}

export { getLinkedInDetailPane } from '@/content/linkedin-extractor';

function hasLinkedInDetailSignals(el: Element): boolean {
  return Boolean(el.querySelector(LINKEDIN_DETAIL_SIGNALS));
}

function resolveLinkedInRootFromAnchor(anchor: Element): Element | null {
  const root =
    anchor.closest('.jobs-search__job-details--container') ??
    anchor.closest('.jobs-search__job-details') ??
    anchor.closest('.scaffold-layout__detail') ??
    anchor.closest('.jobs-details') ??
    anchor.closest('[data-view-name="job-details"]') ??
    anchor.closest('.job-view-layout');

  if (root && !isInsideLinkedInListPane(root)) return root;

  const section = anchor.closest('section, article');
  if (section && !isInsideLinkedInListPane(section)) return section;

  return !isInsideLinkedInListPane(anchor) ? anchor : null;
}

function getLinkedInDetailRoot(doc: Document): Element | null {
  const viaPane = getLinkedInDetailPane(doc);
  if (viaPane && !isInsideLinkedInListPane(viaPane)) return viaPane;

  for (const selector of LINKEDIN_DETAIL_COLUMN_SELECTORS) {
    const column = doc.querySelector(selector);
    if (!column || isInsideLinkedInListPane(column)) continue;
    if (hasLinkedInDetailSignals(column)) return column;
  }

  for (const anchorSelector of LINKEDIN_ANCHOR_SELECTORS) {
    for (const anchor of doc.querySelectorAll(anchorSelector)) {
      if (isInsideLinkedInListPane(anchor)) continue;
      const root = resolveLinkedInRootFromAnchor(anchor);
      if (root) return root;
    }
  }

  const pathname = doc.defaultView?.location.pathname ?? '';
  if (/\/jobs\/view\//i.test(pathname)) {
    const standalone = doc.querySelector('.jobs-details, .job-view-layout');
    if (standalone && !isInsideLinkedInListPane(standalone)) {
      return standalone;
    }
  }

  return null;
}

/** First matching element outside the LinkedIn results list (detail pane wins over list cards). */
export function queryLinkedInOutsideList(
  doc: Document,
  selector: string,
): Element | null {
  for (const el of doc.querySelectorAll(selector)) {
    if (isInsideLinkedInListPane(el)) continue;
    if (
      el.closest(
        '.scaffold-layout__detail, .jobs-search__job-details, .jobs-search__job-details--container, .jobs-details, .job-view-layout',
      )
    ) {
      return el;
    }
  }

  return null;
}

function hasIndeedDetailSignals(el: Element): boolean {
  return Boolean(el.querySelector(INDEED_DETAIL_SIGNALS));
}

function getIndeedDetailRoot(doc: Document): Element | null {
  for (const selector of INDEED_DETAIL_ROOT_SELECTORS) {
    const candidate = doc.querySelector(selector);
    if (candidate && hasIndeedDetailSignals(candidate)) return candidate;
  }

  const description = doc.querySelector('#jobDescriptionText');
  if (description) {
    return (
      description.closest('.jobsearch-JobComponent') ??
      description.closest('#jobsearch-ViewjobPaneWrapper') ??
      description.parentElement
    );
  }

  return null;
}

function getGenericDetailRoot(doc: Document): Element | null {
  for (const selector of GENERIC_DETAIL_ROOT_SELECTORS) {
    const candidate = doc.querySelector(selector);
    if (!candidate) continue;
    const text = candidate.textContent?.trim() ?? '';
    if (text.length >= 120) return candidate;
  }
  return null;
}

/** DOM subtree for the job the user is viewing (not the surrounding results list). */
export function getJobDetailRoot(doc: Document = document, url?: string): Element | null {
  const href = url ?? doc.defaultView?.location.href ?? '';
  const parsed = parseUrl(href);
  if (!parsed) return null;

  const host = parsed.hostname.replace(/^www\./, '');
  if (host.includes('linkedin.com') && parsed.pathname.includes('/jobs/')) {
    return getLinkedInDetailRoot(doc);
  }
  if (host.includes('indeed.com')) {
    return getIndeedDetailRoot(doc);
  }
  return getGenericDetailRoot(doc);
}

/** True when the page shows a job list plus a separate detail pane (only one job should be extracted). */
export function looksLikeSplitViewJobListingPage(
  url: string,
  doc: Document = document,
): boolean {
  const parsed = parseUrl(url);
  if (!parsed) return false;

  const host = parsed.hostname.replace(/^www\./, '');
  if (host.includes('linkedin.com')) {
    if (/\/jobs\/search/i.test(parsed.pathname)) return true;
    return Boolean(
      doc.querySelector(
        '.jobs-search-results-list, .scaffold-layout__list, [data-view-name="job-search-results-list"]',
      ),
    );
  }

  if (host.includes('indeed.com')) {
    if (parsed.pathname.includes('/jobs') && !/viewjob/i.test(url)) return true;
    return Boolean(doc.querySelector('.jobsearch-LeftPane, #mosaic-provider-jobcards'));
  }

  const detailRoot = getJobDetailRoot(doc, url);
  if (!detailRoot) return false;

  const cardSelectors = [
    '[class*="job-card"]',
    '[class*="JobCard"]',
    '[data-testid*="job-card"]',
    '.jobs-search-results-list li',
  ].join(', ');

  const cards = doc.querySelectorAll(cardSelectors);
  return cards.length >= 2;
}

/** Selectors for stripping list columns when cloning a detail root for text extraction. */
export const SPLIT_VIEW_LIST_STRIP_SELECTORS = [
  '.jobs-search-results-list',
  '.scaffold-layout__list',
  '[data-view-name="job-search-results-list"]',
  '.jobsearch-LeftPane',
  '#mosaic-provider-jobcards',
].join(', ');
