import type { ExtractedJob } from '@/shared/types';

import {
  extractFromLinkedIn,
  isLinkedInJobsPage,
  isValidLinkedInTitle,
} from '@/content/linkedin-extractor';
import {
  getJobDetailRoot,
  looksLikeSplitViewJobListingPage,
  SPLIT_VIEW_LIST_STRIP_SELECTORS,
} from '@/content/job-detail-scope';
import { pageHasJobPostingSignals } from '@/content/job-page-heuristics';
import { isApplyMateAppUrl, isExcludedNonJobSiteUrl } from '@/shared/job-page-url';

const SITE_EXTRACTORS = [
  extractFromLinkedIn,
  extractFromIndeed,
  extractFromGreenhouse,
  extractFromLever,
  extractFromWorkday,
  extractFromJobberman,
  extractFromJobgether,
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
  '[class*="match-score"]',
  '[class*="MatchScore"]',
  '[class*="premium"]',
  '[class*="Premium"]',
  '[class*="auto-apply"]',
  '[class*="AutoApply"]',
  '[class*="trustpilot"]',
  '[class*="Trustpilot"]',
  '[class*="login"]',
  '[class*="signup"]',
  '[class*="SignUp"]',
  '[class*="report-job"]',
  '[class*="ReportJob"]',
  '[id*="similar"]',
  '[id*="related"]',
  '[aria-label*="similar"]',
  '[aria-label*="Similar"]',
  '[aria-label*="related"]',
  '[aria-label*="Related"]',
  '[data-testid*="similar"]',
  '[data-testid*="related"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
].join(', ');

const RELATED_JOBS_TEXT_PATTERN =
  /\b(similar\s+(remote\s+)?jobs|related\s+jobs|you\s+may\s+also\s+like|recommended\s+jobs|more\s+openings|sign\s+up\s+to\s+save|other\s+jobs\s+at|continue\s+with\s+linkedin|help\s+us\s+maintain\s+the\s+quality|review\s+jobgether|upgrade\s+to\s+premium)\b/i;

const DESCRIPTION_END_MARKERS = [
  /\brelated\s+jobs\b/i,
  /\bother\s+jobs\s+at\b/i,
  /\bhelp\s+us\s+maintain\s+the\s+quality\b/i,
  /\bselect\s+the\s+reason\s+you['’]re\s+reporting\b/i,
  /\bcontinue\s+with\s+linkedin\b/i,
  /\bwe\s+help\s+you\s+get\s+seen\b/i,
  /\bremote\s+jobs\s+remote\b/i,
  /\bready\s+to\s+apply\?\s*$/im,
];

const NOISE_LINE_PATTERNS = [
  /^your match score\b/i,
  /sign in to unlock/i,
  /\bauto[\s-]?apply\b/i,
  /^apply$/i,
  /^share$/i,
  /^report$/i,
  /go premium/i,
  /unlock your full potential/i,
  /you['’]ve reached your free limit/i,
  /review match analysis/i,
  /not a fit for this role/i,
  /match feedback/i,
  /avoid rejection for the wrong reasons/i,
  /get noticed with premium/i,
  /join \d[\d,+\s]* premium members/i,
  /complete profile to see match/i,
  /trustpilot/i,
  /review jobgether/i,
  /continue with linkedin/i,
  /continue with google/i,
  /^less$/i,
  /^more$/i,
  /^loading\.\.\.$/i,
  /^or loading\.\.\.$/i,
  /^✕$/,
  /^★$/,
  /^·$/,
  /^—%$/,
  /^—$/,
  /^\d+%$/,
  /^\+\d+\s+more$/,
  /cv review personalized analysis/i,
  /found your cv review helpful/i,
  /^a quick favor from our team/i,
  /^reviewed$/i,
  /^remote jobs remote\b/i,
  /^selected,\s/i,
  /viewed · posted/i,
  /be an early applicant · posted/i,
  /are these results helpful\?/i,
  /see jobs where you.re a top applicant/i,
  /we.ve found more results that may interest you/i,
  /^easy apply$/i,
  /^linkedin corporation ©/i,
];

const JOB_DESCRIPTION_START_MARKERS = [
  /^job description\b/i,
  /^job title:/i,
  /^what you will be responsible for\b/i,
  /^what you'll be responsible for\b/i,
  /^what you will bring\b/i,
  /^who you are\b/i,
  /^about (the )?(role|job|position)\b/i,
  /^responsibilities\b/i,
  /^requirements\b/i,
  /^qualifications\b/i,
];

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

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 2 && !/[a-z0-9]/i.test(trimmed)) return true;
  return NOISE_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function stripToJobDescriptionStart(text: string): string {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? '';
    if (JOB_DESCRIPTION_START_MARKERS.some((pattern) => pattern.test(line))) {
      return lines.slice(i).join('\n').trim();
    }
  }
  return text;
}

function cutAtDescriptionEnd(text: string): string {
  let cutAt = text.length;
  for (const pattern of DESCRIPTION_END_MARKERS) {
    const match = pattern.exec(text);
    if (match && match.index > 120 && match.index < cutAt) {
      cutAt = match.index;
    }
  }
  return text.slice(0, cutAt).trim();
}

/** Remove CTA / match-score / premium noise and keep the posting body. */
export function finalizeDescription(text: string | null | undefined): string {
  if (!text) return '';
  let normalized = normalizeWhitespace(text);
  normalized = stripToJobDescriptionStart(normalized);
  normalized = cutAtDescriptionEnd(normalized);

  const match = RELATED_JOBS_TEXT_PATTERN.exec(normalized);
  if (match && match.index > 200) {
    normalized = normalized.slice(0, match.index).trim();
  }

  const kept: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of normalized.split('\n')) {
    const line = rawLine.trim();
    if (!line || isNoiseLine(line)) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(line);
  }

  return kept.join('\n\n').slice(0, MAX_JOB_DESCRIPTION);
}

/** Cut related-job carousels and footers from extracted description text. */
export function trimJobDescription(text: string | null | undefined): string {
  return finalizeDescription(text);
}

export function cleanDescription(text: string | null | undefined): string {
  return finalizeDescription(text);
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
 * On split-view boards, only reads the open job detail pane — never the results list.
 */
export function collectPrimaryJobText(doc: Document = document): string {
  const url = doc.defaultView?.location.href ?? '';
  const detailRoot = getJobDetailRoot(doc, url);

  if (detailRoot) {
    const scoped = collectTextFromRoot(detailRoot);
    if (scoped.length >= 200) return scoped;

    const descriptionSelectors = [
      '.jobs-description__content .jobs-box__html-content',
      '.jobs-description__content',
      '#jobDescriptionText',
      '[data-automation-id="jobPostingDescription"]',
      '[class*="job-description"]',
      '[class*="JobDescription"]',
      '[id*="job-description"]',
    ];
    for (const selector of descriptionSelectors) {
      const el = detailRoot.querySelector(selector);
      if (!el) continue;
      const text = trimJobDescription(normalizeWhitespace(el.textContent ?? ''));
      if (text.length >= 200) return text.slice(0, MAX_RAW_TEXT);
    }
  }

  if (looksLikeSplitViewJobListingPage(url, doc)) {
    return detailRoot ? collectTextFromRoot(detailRoot) : '';
  }

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

  for (const root of roots) {
    const text = collectTextFromRoot(root);
    if (text.length >= 200) return text;
  }

  return collectLegacyPageText(doc);
}

const SPLIT_VIEW_LIST_SELECTORS = SPLIT_VIEW_LIST_STRIP_SELECTORS;

function collectTextFromRoot(root: Element): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(PRIMARY_NOISE_SELECTORS).forEach((el) => el.remove());
  clone.querySelectorAll(SPLIT_VIEW_LIST_SELECTORS).forEach((el) => el.remove());
  const text = normalizeWhitespace(clone.innerText ?? '');
  return trimJobDescription(text).slice(0, MAX_RAW_TEXT);
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

function textFromRoot(root: Element | Document, selector: string): string {
  return cleanText(root.querySelector(selector)?.textContent ?? '');
}

function descriptionFrom(...selectors: string[]): string {
  for (const selector of selectors) {
    const cleaned = cleanDescription(document.querySelector(selector)?.textContent);
    if (cleaned.length >= 80) return cleaned;
  }
  return '';
}

function descriptionFromRoot(root: Element | Document, ...selectors: string[]): string {
  for (const selector of selectors) {
    const cleaned = cleanDescription(root.querySelector(selector)?.textContent);
    if (cleaned.length >= 80) return cleaned;
  }
  return '';
}

function readImageSrc(el: Element | null | undefined): string | null {
  if (!el) return null;
  const img = el instanceof HTMLImageElement ? el : el.querySelector('img');
  if (!(img instanceof HTMLImageElement)) return null;
  const src = img.currentSrc?.trim() || img.src?.trim() || img.getAttribute('src')?.trim();
  if (!src || !/^https?:\/\//i.test(src)) return null;
  return src;
}

function logoFromSelectors(...selectors: string[]): string | null {
  for (const selector of selectors) {
    const src = readImageSrc(document.querySelector(selector));
    if (src) return src;
  }
  return null;
}

function logoFromSelectorsInRoot(root: Element | Document, ...selectors: string[]): string | null {
  for (const selector of selectors) {
    const src = readImageSrc(root.querySelector(selector));
    if (src) return src;
  }
  return null;
}

function schemaTypeMatches(type: unknown, expected: string): boolean {
  if (typeof type === 'string') {
    return type === expected || type.endsWith(`/${expected}`);
  }
  if (Array.isArray(type)) {
    return type.some((entry) => schemaTypeMatches(entry, expected));
  }
  return false;
}

function logoFromSchemaNode(node: Record<string, unknown>): string | null {
  const org = node.hiringOrganization;
  if (org && typeof org === 'object' && !Array.isArray(org)) {
    const orgRecord = org as Record<string, unknown>;
    if (typeof orgRecord.logo === 'string' && orgRecord.logo.startsWith('http')) {
      return orgRecord.logo;
    }
    if (typeof orgRecord.image === 'string' && orgRecord.image.startsWith('http')) {
      return orgRecord.image;
    }
  }
  if (typeof node.logo === 'string' && node.logo.startsWith('http')) {
    return node.logo;
  }
  if (typeof node.image === 'string' && node.image.startsWith('http')) {
    return node.image;
  }
  return null;
}

export function extractLogoFromJsonLd(): string | null {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');

  for (const script of Array.from(scripts)) {
    try {
      const raw = script.textContent ?? '';
      if (!raw.trim()) continue;

      const data = JSON.parse(raw) as unknown;
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const record = item as Record<string, unknown>;

        if (schemaTypeMatches(record['@type'], 'JobPosting')) {
          const logo = logoFromSchemaNode(record);
          if (logo) return logo;
        }

        if (schemaTypeMatches(record['@type'], 'Organization')) {
          const logo = logoFromSchemaNode(record);
          if (logo) return logo;
        }

        if (Array.isArray(record['@graph'])) {
          for (const node of record['@graph']) {
            if (!node || typeof node !== 'object') continue;
            const graphNode = node as Record<string, unknown>;
            if (
              schemaTypeMatches(graphNode['@type'], 'JobPosting') ||
              schemaTypeMatches(graphNode['@type'], 'Organization')
            ) {
              const logo = logoFromSchemaNode(graphNode);
              if (logo) return logo;
            }
          }
        }
      }
    } catch {
      /* malformed JSON — skip */
    }
  }

  return null;
}

function extractSiteSpecificLogo(): string | null {
  const host = window.location.hostname;
  if (host.includes('linkedin.com')) {
    return null;
  }
  const detailRoot = getJobDetailRoot(document, window.location.href);
  if (host.includes('indeed.com')) {
    const root = detailRoot ?? document;
    return logoFromSelectorsInRoot(
      root,
      '[data-testid="inlineHeader-companyLogo"] img',
      '.jobsearch-CompanyAvatar img',
    );
  }
  if (host.includes('greenhouse.io') || host.includes('boards.greenhouse.io')) {
    return logoFromSelectors('.logo img', '#logo img');
  }
  if (host.includes('lever.co')) {
    return logoFromSelectors('.posting-headline .logo img', '.main-header-logo img');
  }
  if (host.includes('myworkdayjobs.com') || host.includes('workday.com')) {
    return logoFromSelectors('[data-automation-id="companyLogo"] img');
  }
  return logoFromSelectors('[itemprop="logo"]', 'img[alt*="logo" i]');
}

function extractOgImageLogo(): string | null {
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  if (ogImage?.startsWith('http')) return ogImage;
  return null;
}

function resolvePageLogo(): Pick<ExtractedJob, 'logoCandidateUrl' | 'logoSource'> | null {
  const jsonLd = extractLogoFromJsonLd();
  if (jsonLd) {
    return { logoCandidateUrl: jsonLd, logoSource: 'json-ld' };
  }

  const domLogo = extractSiteSpecificLogo();
  if (domLogo) {
    return { logoCandidateUrl: domLogo, logoSource: 'site-extractor' };
  }

  const ogLogo = extractOgImageLogo();
  if (ogLogo) {
    return { logoCandidateUrl: ogLogo, logoSource: 'og-image' };
  }

  return null;
}

function buildJob(partial: Omit<ExtractedJob, 'sourceUrl' | 'confidence' | 'extractedBy'>): ExtractedJob | null {
  if (!partial.title.trim()) return null;
  if (partial.sourceSite === 'linkedin.com' && !isValidLinkedInTitle(partial.title)) {
    return null;
  }

  const resolvedLogo =
    partial.logoCandidateUrl?.trim() && partial.logoSource
      ? {
          logoCandidateUrl: partial.logoCandidateUrl.trim(),
          logoSource: partial.logoSource,
        }
      : partial.logoCandidateUrl?.trim()
        ? { logoCandidateUrl: partial.logoCandidateUrl.trim(), logoSource: 'site-extractor' as const }
        : partial.sourceSite === 'linkedin.com'
          ? null
          : resolvePageLogo();

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
    ...(resolvedLogo ?? {}),
    sourceUrl: window.location.href,
    confidence: 'high',
    extractedBy: 'site-extractor',
  };
}

function extractFromIndeed(): ExtractedJob | null {
  if (!window.location.hostname.includes('indeed.com')) return null;

  const root = getJobDetailRoot(document, window.location.href);
  if (looksLikeSplitViewJobListingPage(window.location.href) && !root) return null;

  const scope = root ?? document;

  const title =
    textFromRoot(scope, '[data-testid="jobsearch-JobInfoHeader-title"] span') ||
    textFromRoot(scope, 'h1.jobsearch-JobInfoHeader-title');

  const company =
    textFromRoot(scope, '[data-testid="inlineHeader-companyName"] a') ||
    textFromRoot(scope, '.jobsearch-InlineCompanyRating-companyHeader');

  const location =
    textFromRoot(scope, '[data-testid="job-location"]') ||
    textFromRoot(scope, '.jobsearch-JobInfoHeader-subtitle .css-6z8o9s');

  const description = root
    ? descriptionFromRoot(root, '#jobDescriptionText')
    : descriptionFrom('#jobDescriptionText');

  const snippets = Array.from(
    scope.querySelectorAll('[data-testid="attribute_snippet_testid"]'),
  ).map((el) => cleanText(el.textContent));

  const salary = snippets.find((s) => /\$|£|€|salary|year|hour/i.test(s)) ?? null;
  const jobType =
    snippets
      .map((s) => normaliseJobType(s))
      .find((s) => s && /full-time|part-time|contract|internship|temporary/i.test(s)) ??
    null;

  const postedDate =
    cleanText(scope.querySelector('[data-testid="myJobsStateDate"]')?.textContent) || null;

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
    textFrom('[class*="company-name"]') ||
    textFrom('.employer-name') ||
    inferCompanyFromPage();

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

function extractFromJobgether(): ExtractedJob | null {
  const host = window.location.hostname.replace(/^www\./, '');
  if (!host.includes('jobgether')) return null;

  const url = window.location.href;
  const detailRoot = getJobDetailRoot(document, url);
  if (looksLikeSplitViewJobListingPage(url) && !detailRoot) return null;

  const scope = detailRoot ?? document;
  const scopeText = detailRoot ? collectTextFromRoot(detailRoot) : (document.body?.innerText ?? '');

  const title =
    textFromRoot(scope, 'h1') ||
    metaContent('meta[property="og:title"]') ||
    cleanText(document.title.split('|')[0]?.split('-')[0]);

  const company = inferCompanyFromPage();

  const location =
    textFromRoot(scope, '[class*="location"]') ||
    textFromRoot(scope, '[data-testid*="location"]') ||
    (() => {
      const remoteMatch = scopeText.match(/\bremote from:\s*([^\n]+)/i);
      return remoteMatch?.[1] ? cleanText(remoteMatch[1]) : '';
    })();

  const salary = (() => {
    const salaryMatch = scopeText.match(/\bsalary:\s*([^\n]+)/i);
    return salaryMatch?.[1] ? cleanText(salaryMatch[1]) : null;
  })();

  const jobType = (() => {
    if (/\bfull[\s-]?time\b/i.test(scopeText)) return 'Full-time';
    if (/\bpart[\s-]?time\b/i.test(scopeText)) return 'Part-time';
    if (/\bcontract\b/i.test(scopeText)) return 'Contract';
    return null;
  })();

  const description = finalizeDescription(
    descriptionFromRoot(
      scope,
      '[class*="job-description"]',
      '[class*="JobDescription"]',
      '[id*="job-description"]',
    ) || (detailRoot ? collectTextFromRoot(detailRoot) : extractLargestTextBlock()),
  );

  return buildJob({
    title,
    company,
    location,
    description,
    salary,
    jobType: normaliseJobType(jobType),
    experienceLevel: null,
    postedDate: null,
    sourceSite: host,
  });
}

function companyFromHostname(): string {
  const host = window.location.hostname.replace(/^www\./, '');
  const parts = host.split('.');
  if (parts.length < 2) return '';
  const label = parts[parts.length - 2] ?? '';
  if (!label || ['jobs', 'careers', 'apply', 'boards', 'workday', 'jobgether'].includes(label)) {
    return '';
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function companyFromPostedAgoLine(text: string): string {
  const match = text.match(
    /(?:•\s*)?(?:\d+\+\s*)?(?:\d+\s*)?days?\s+ago\s+([^—–\-\n|%]+?)(?:\s*[—–\-]|$)/i,
  );
  return match?.[1] ? cleanText(match[1]) : '';
}

function companyFromOtherJobsAt(text: string): string {
  const match = text.match(/\bother jobs at\s+([^\n]+)/i);
  return match?.[1] ? cleanText(match[1]) : '';
}

function inferCompanyFromPage(doc: Document = document): string {
  const fromSelector =
    textFrom('[class*="company-name"]') ||
    textFrom('[class*="employer-name"]') ||
    textFrom('[class*="Employer"]') ||
    textFrom('[data-testid*="company"]') ||
    textFrom('[itemprop="hiringOrganization"]') ||
    metaContent('meta[property="og:site_name"]');

  if (fromSelector) return fromSelector;

  const headerSlice = (doc.body?.innerText ?? '').slice(0, 1200);
  const fromAgo = companyFromPostedAgoLine(headerSlice);
  if (fromAgo) return fromAgo;

  const fromOtherJobs = companyFromOtherJobsAt(doc.body?.innerText ?? '');
  if (fromOtherJobs) return fromOtherJobs;

  const pageTitle = doc.title;
  const atMatch = pageTitle.match(/\bat\s+(.+?)(?:\||-|$)/i);
  if (atMatch?.[1]) return cleanText(atMatch[1]);

  return companyFromHostname();
}

function metaContent(selector: string): string {
  return cleanText(document.querySelector(selector)?.getAttribute('content'));
}

function extractLargestTextBlock(): string {
  const collected = collectVisibleJobText();
  if (collected.length >= 120) return collected;
  if (looksLikeSplitViewJobListingPage(window.location.href)) return collected;
  return cleanDescription(document.body?.innerText);
}

function extractFromGenericCareersPage(): ExtractedJob | null {
  const host = window.location.hostname.replace(/^www\./, '');
  if (host.includes('linkedin.com') || host.includes('indeed.com')) return null;
  if (!pageHasJobPostingSignals()) return null;

  const url = window.location.href;
  const detailRoot = getJobDetailRoot(document, url);
  if (looksLikeSplitViewJobListingPage(url) && !detailRoot) return null;

  const scope = detailRoot ?? document;

  const title =
    textFromRoot(scope, 'h1') ||
    metaContent('meta[property="og:title"]') ||
    cleanText(document.title.split('|')[0]?.split('-')[0]);

  let company = inferCompanyFromPage();

  const pageTitle = document.title;
  const atMatch = pageTitle.match(/\bat\s+(.+?)(?:\||-|$)/i);
  if (!company && atMatch?.[1]) {
    company = cleanText(atMatch[1]);
  }

  const location =
    textFromRoot(scope, '[class*="location"]') ||
    textFromRoot(scope, '[data-automation-id="location"]') ||
    textFromRoot(scope, '[itemprop="addressLocality"]');

  const description = detailRoot ? collectTextFromRoot(detailRoot) : extractLargestTextBlock();
  if (description.length < 80) return null;

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

const LINKEDIN_EXTRACT_MAX_ATTEMPTS = 5;
const LINKEDIN_EXTRACT_WAIT_MS = 1000;
const LINKEDIN_MIN_DESCRIPTION_LEN = 100;

/** LinkedIn renders the JD asynchronously — retry before giving up. */
export async function extractJobFromPageWithRetry(): Promise<ExtractedJob | null> {
  if (!isLinkedInJobsPage(window.location.href)) {
    return extractJobFromPage();
  }

  for (let attempt = 1; attempt <= LINKEDIN_EXTRACT_MAX_ATTEMPTS; attempt++) {
    const job = await extractJobFromPage();
    if (job?.description && job.description.length > LINKEDIN_MIN_DESCRIPTION_LEN) {
      return job;
    }
    if (attempt < LINKEDIN_EXTRACT_MAX_ATTEMPTS) {
      await new Promise((resolve) => window.setTimeout(resolve, LINKEDIN_EXTRACT_WAIT_MS));
    }
  }

  return extractJobFromPage();
}

export function collectAiFallbackPayload(): {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
} | null {
  if (isLinkedInJobsPage(window.location.href)) return null;
  if (isExcludedNonJobSiteUrl(window.location.href)) return null;
  if (!pageHasJobPostingSignals()) return null;

  const rawText = collectPrimaryJobText();
  if (rawText.length < 200) return null;
  return {
    rawText,
    pageTitle: document.title,
    pageUrl: window.location.href,
  };
}
