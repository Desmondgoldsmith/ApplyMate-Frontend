import type { ExtractedJob } from '@/shared/types';

import { pageHasJobPostingSignals } from '@/content/job-page-heuristics';
import { isApplyMateAppUrl } from '@/shared/job-page-url';

const SITE_EXTRACTORS = [
  extractFromLinkedIn,
  extractFromIndeed,
  extractFromGreenhouse,
  extractFromLever,
  extractFromWorkday,
  extractFromJobberman,
  extractFromGenericCareersPage,
] as const;

export const MAX_RAW_TEXT = 12_000;
export const MAX_JOB_DESCRIPTION = 12_000;

const PRIMARY_NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'nav',
  'footer',
  'header',
  'aside',
  '[class*="similar"]',
  '[class*="Similar"]',
  '[class*="related"]',
  '[class*="Related"]',
  '[class*="recommend"]',
  '[class*="Recommend"]',
  '[id*="similar"]',
  '[id*="related"]',
  '[aria-label*="similar"]',
  '[aria-label*="Similar"]',
  '[aria-label*="related"]',
  '[aria-label*="Related"]',
  '[data-testid*="similar"]',
  '[data-testid*="related"]',
].join(', ');

const RELATED_JOBS_TEXT_PATTERN =
  /\b(similar\s+(remote\s+)?jobs|related\s+jobs|you\s+may\s+also\s+like|recommended\s+jobs|more\s+openings|sign\s+up\s+to\s+save)\b/i;

function normalizeWhitespace(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return normalizeWhitespace(text).slice(0, 2000);
}

/** Cut related-job carousels and footers from extracted description text. */
export function trimJobDescription(text: string | null | undefined): string {
  if (!text) return '';
  const normalized = normalizeWhitespace(text);
  const match = RELATED_JOBS_TEXT_PATTERN.exec(normalized);
  if (match && match.index > 200) {
    return normalized.slice(0, match.index).trim().slice(0, MAX_JOB_DESCRIPTION);
  }
  return normalized.slice(0, MAX_JOB_DESCRIPTION);
}

export function cleanDescription(text: string | null | undefined): string {
  return trimJobDescription(text);
}

/** Legacy whole-body scrape — kept as fallback when primary container is too short. */
export function collectLegacyPageText(doc: Document = document): string {
  if (!doc.body) return '';
  const clone = doc.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, noscript, svg, nav, footer, header').forEach((el) => el.remove());
  return normalizeWhitespace(clone.innerText ?? '').slice(0, MAX_RAW_TEXT);
}

/**
 * Prefer explicit job-description containers; strip similar/related job blocks.
 * Falls back to legacy body scrape when &lt; 200 chars.
 */
export function collectPrimaryJobText(doc: Document = document): string {
  const roots: Element[] = [];
  const push = (el: Element | null) => {
    if (el && !roots.includes(el)) roots.push(el);
  };

  push(doc.querySelector('[data-job-description]'));
  push(doc.querySelector('[data-automation-id="jobPostingDescription"]'));
  push(doc.querySelector('[class*="job-description"]'));
  push(doc.querySelector('[class*="JobDescription"]'));
  push(doc.querySelector('[id*="job-description"]'));
  push(doc.querySelector('article'));
  push(doc.querySelector('main'));
  push(doc.body);

  for (const root of roots) {
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(PRIMARY_NOISE_SELECTORS).forEach((el) => el.remove());
    const text = normalizeWhitespace(clone.innerText ?? '');
    if (text.length >= 200) {
      return trimJobDescription(text).slice(0, MAX_RAW_TEXT);
    }
  }

  return collectLegacyPageText(doc);
}

/** @deprecated Use collectPrimaryJobText */
export function collectVisibleJobText(doc: Document = document): string {
  return collectPrimaryJobText(doc);
}

export function normaliseJobType(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if (/(full[\s-]?time|fulltime)/i.test(lower)) return 'Full-time';
  if (/(part[\s-]?time|parttime)/i.test(lower)) return 'Part-time';
  if (/(contractor|contract[\s-]?role|^contract$)/i.test(lower)) return 'Contract';
  if (/(internship|^intern$)/i.test(lower)) return 'Internship';
  return value;
}

function textFrom(selector: string): string {
  return cleanText(document.querySelector(selector)?.textContent ?? '');
}

function descriptionFrom(...selectors: string[]): string {
  for (const selector of selectors) {
    const cleaned = cleanDescription(document.querySelector(selector)?.textContent);
    if (cleaned.length >= 80) return cleaned;
  }
  return '';
}

function buildJob(partial: Omit<ExtractedJob, 'sourceUrl' | 'confidence' | 'extractedBy'>): ExtractedJob | null {
  if (!partial.title.trim()) return null;
  return {
    ...partial,
    title: cleanText(partial.title),
    company: cleanText(partial.company),
    location: cleanText(partial.location),
    description: cleanDescription(partial.description),
    salary: partial.salary ? cleanText(partial.salary) : null,
    jobType: normaliseJobType(partial.jobType),
    experienceLevel: partial.experienceLevel ? cleanText(partial.experienceLevel) : null,
    postedDate: partial.postedDate ? cleanText(partial.postedDate) : null,
    sourceUrl: window.location.href,
    confidence: 'high',
    extractedBy: 'site-extractor',
  };
}

function mapLinkedInExperience(raw: string): string | null {
  const value = raw.trim();
  if (/entry/i.test(value)) return 'Entry';
  if (/mid/i.test(value)) return 'Mid';
  if (/senior/i.test(value)) return 'Senior';
  if (/director|executive/i.test(value)) return 'Executive';
  return cleanText(value) || null;
}

function readInsightPills(): string[] {
  return Array.from(
    document.querySelectorAll('.job-details-jobs-unified-top-card__job-insight'),
  ).map((el) => cleanText(el.textContent));
}

function extractFromLinkedIn(): ExtractedJob | null {
  if (!window.location.hostname.includes('linkedin.com')) return null;
  if (!window.location.pathname.includes('/jobs/')) return null;

  const title =
    textFrom('.job-details-jobs-unified-top-card__job-title h1') ||
    textFrom('h1.t-24');

  const company =
    textFrom('.job-details-jobs-unified-top-card__company-name a') ||
    textFrom('.job-details-jobs-unified-top-card__company-name');

  const location =
    textFrom(
      '.job-details-jobs-unified-top-card__primary-description-without-tagline .tvm__text',
    ) || textFrom('.job-details-jobs-unified-top-card__bullet');

  const description =
    descriptionFrom(
      '.jobs-description__content .jobs-box__html-content',
      '#job-details',
    );

  const salary =
    cleanText(
      document.querySelector('.job-details-jobs-unified-top-card__job-insight--highlight')
        ?.textContent,
    ) || null;

  const insights = readInsightPills();
  let jobType: string | null = null;
  let experienceLevel: string | null = null;
  for (const insight of insights) {
    if (!jobType && /full-time|part-time|contract|internship/i.test(insight)) {
      jobType = normaliseJobType(insight);
    }
    if (
      !experienceLevel &&
      /entry level|mid-senior level|director|executive/i.test(insight)
    ) {
      experienceLevel = mapLinkedInExperience(insight);
    }
  }

  const postedDate =
    cleanText(
      document.querySelector('.job-details-jobs-unified-top-card__posted-date')?.textContent,
    ) || null;

  return buildJob({
    title,
    company,
    location,
    description,
    salary,
    jobType,
    experienceLevel,
    postedDate,
    sourceSite: 'linkedin.com',
  });
}

function extractFromIndeed(): ExtractedJob | null {
  if (!window.location.hostname.includes('indeed.com')) return null;

  const title =
    textFrom('[data-testid="jobsearch-JobInfoHeader-title"] span') ||
    textFrom('h1.jobsearch-JobInfoHeader-title');

  const company =
    textFrom('[data-testid="inlineHeader-companyName"] a') ||
    textFrom('.jobsearch-InlineCompanyRating-companyHeader');

  const location =
    textFrom('[data-testid="job-location"]') ||
    textFrom('.jobsearch-JobInfoHeader-subtitle .css-6z8o9s');

  const description = descriptionFrom('#jobDescriptionText');

  const snippets = Array.from(
    document.querySelectorAll('[data-testid="attribute_snippet_testid"]'),
  ).map((el) => cleanText(el.textContent));

  const salary = snippets.find((s) => /\$|£|€|salary|year|hour/i.test(s)) ?? null;
  const jobType =
    snippets
      .map((s) => normaliseJobType(s))
      .find((s) => s && /full-time|part-time|contract|internship|temporary/i.test(s)) ??
    null;

  const postedDate =
    cleanText(document.querySelector('[data-testid="myJobsStateDate"]')?.textContent) || null;

  return buildJob({
    title,
    company,
    location,
    description,
    salary,
    jobType,
    experienceLevel: null,
    postedDate,
    sourceSite: 'indeed.com',
  });
}

function extractFromGreenhouse(): ExtractedJob | null {
  const host = window.location.hostname;
  if (!host.includes('greenhouse.io')) return null;

  const title =
    textFrom('h1.app-title') || textFrom('.job-post h1') || textFrom('h1');

  let company = textFrom('.company-name');
  if (!company) {
    const pageTitle = document.title;
    const atIndex = pageTitle.lastIndexOf(' at ');
    if (atIndex >= 0) {
      company = cleanText(pageTitle.slice(atIndex + 4));
    }
  }

  const location =
    textFrom('.location') || textFrom('[class*="location"]');

  const description = descriptionFrom('#content', '.job-post-description');

  const jobType =
    cleanText(document.querySelector('[class*="employment-type"]')?.textContent) || null;

  return buildJob({
    title,
    company,
    location,
    description,
    salary: null,
    jobType: normaliseJobType(jobType),
    experienceLevel: null,
    postedDate: null,
    sourceSite: host.replace(/^www\./, ''),
  });
}

function extractFromLever(): ExtractedJob | null {
  if (!window.location.hostname.includes('lever.co')) return null;

  const title = textFrom('.posting-headline h2') || textFrom('h2');

  let company = '';
  const pageTitle = document.title;
  const dashParts = pageTitle.split(' - ');
  if (dashParts.length > 1) {
    company = cleanText(dashParts[dashParts.length - 1]);
  }

  const location =
    textFrom('.sort-by-time.posting-category') || textFrom('[class*="location"]');

  const description = descriptionFrom('.content');

  const salary =
    cleanText(document.querySelector('[class*="compensation"]')?.textContent) || null;
  const jobType =
    cleanText(document.querySelector('[class*="work-type"]')?.textContent) || null;

  return buildJob({
    title,
    company,
    location,
    description,
    salary,
    jobType: normaliseJobType(jobType),
    experienceLevel: null,
    postedDate: null,
    sourceSite: 'lever.co',
  });
}

function extractFromWorkday(): ExtractedJob | null {
  const host = window.location.hostname;
  if (!host.includes('myworkdayjobs.com') && !host.includes('wd3.myworkday.com')) {
    return null;
  }

  const title =
    textFrom('[data-automation-id="jobPostingHeader"]') ||
    textFrom('h2[class*="title"]');

  const subdomain = host.split('.')[0] ?? '';
  const company = subdomain
    ? subdomain.charAt(0).toUpperCase() + subdomain.slice(1)
    : '';

  const location =
    textFrom('[data-automation-id="location"]') || textFrom('[class*="location"]');

  const description = descriptionFrom('[data-automation-id="jobPostingDescription"]');

  const jobType =
    cleanText(document.querySelector('[data-automation-id="Time_Type"]')?.textContent) ||
    null;

  const postedDate =
    cleanText(document.querySelector('[data-automation-id="postedOn"]')?.textContent) || null;

  return buildJob({
    title,
    company,
    location,
    description,
    salary: null,
    jobType: normaliseJobType(jobType),
    experienceLevel: null,
    postedDate,
    sourceSite: host.replace(/^www\./, ''),
  });
}

function extractFromJobberman(): ExtractedJob | null {
  if (!window.location.hostname.includes('jobberman.com')) return null;

  const title = textFrom('h1.text-gray-900') || textFrom('h1');

  const company =
    textFrom('[class*="company-name"]') || textFrom('.employer-name');

  const location =
    textFrom('[class*="location"]') ||
    cleanText(document.querySelector('[itemprop="addressLocality"]')?.textContent);

  const description = descriptionFrom('[class*="job-description"]', '#job-description');

  const salary = textFrom('[class*="salary"]') || null;
  const jobType = textFrom('[class*="job-type"]') || null;
  const postedDate =
    document.querySelector('time')?.getAttribute('datetime')?.trim() ?? null;

  return buildJob({
    title,
    company,
    location,
    description,
    salary: salary || null,
    jobType: normaliseJobType(jobType),
    experienceLevel: null,
    postedDate,
    sourceSite: 'jobberman.com',
  });
}

function companyFromHostname(): string {
  const host = window.location.hostname.replace(/^www\./, '');
  const parts = host.split('.');
  if (parts.length < 2) return '';
  const label = parts[parts.length - 2] ?? '';
  if (!label || ['jobs', 'careers', 'apply', 'boards', 'workday'].includes(label)) {
    return '';
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function metaContent(selector: string): string {
  return cleanText(document.querySelector(selector)?.getAttribute('content'));
}

function extractLargestTextBlock(): string {
  const collected = collectVisibleJobText();
  if (collected.length >= 120) return collected;
  return cleanDescription(document.body?.innerText);
}

function extractFromGenericCareersPage(): ExtractedJob | null {
  if (!pageHasJobPostingSignals()) return null;

  const title =
    textFrom('h1') ||
    metaContent('meta[property="og:title"]') ||
    cleanText(document.title.split('|')[0]?.split('-')[0]);

  let company =
    textFrom('[class*="company-name"]') ||
    textFrom('[class*="employer"]') ||
    metaContent('meta[property="og:site_name"]') ||
    companyFromHostname();

  const pageTitle = document.title;
  const atMatch = pageTitle.match(/\bat\s+(.+?)(?:\||-|$)/i);
  if (!company && atMatch?.[1]) {
    company = cleanText(atMatch[1]);
  }

  const location =
    textFrom('[class*="location"]') ||
    textFrom('[data-automation-id="location"]') ||
    textFrom('[itemprop="addressLocality"]');

  const description = extractLargestTextBlock();

  const host = window.location.hostname.replace(/^www\./, '');

  return buildJob({
    title,
    company,
    location,
    description,
    salary: null,
    jobType: null,
    experienceLevel: null,
    postedDate: null,
    sourceSite: host,
  });
}

export async function extractJobFromPage(): Promise<ExtractedJob | null> {
  if (isApplyMateAppUrl(window.location.href)) return null;
  for (const extract of SITE_EXTRACTORS) {
    const job = extract();
    if (job) return job;
  }
  return null;
}

export function collectAiFallbackPayload(): {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
} | null {
  if (
    !pageHasJobPostingSignals() &&
    !window.location.pathname.match(/\/(jobs?|careers?|openings?)\//i)
  ) {
    const text = document.body?.innerText ?? '';
    if (text.length < 500) return null;
  }
  const rawText = collectPrimaryJobText();
  if (rawText.length < 200) return null;
  return {
    rawText,
    pageTitle: document.title,
    pageUrl: window.location.href,
  };
}
