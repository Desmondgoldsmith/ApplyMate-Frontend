import type { ExtractedJob } from '@/shared/types';

const LINKEDIN_UI_NOISE = [
  'are these results helpful',
  'see jobs where you',
  'people also viewed',
  'get job alerts',
  'show all',
  'try premium',
  'sign in',
  'join now',
  'linkedin',
  'connections who work',
  'salary insights',
  'we found more results',
  "we've found more results",
  'promoted',
  'your feedback helps',
  'see jobs where you’re a top applicant',
];

const DETAIL_PANE_SELECTORS = [
  '.jobs-search__job-details--wrapper',
  '.jobs-search__job-details--container',
  '.jobs-search__job-details',
  '[data-view-name="job-details"]',
  '.scaffold-layout__detail',
  '.jobs-details',
  '.job-view-layout',
] as const;

function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function normaliseJobType(raw: string | null): string | null {
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

function cleanLinkedInDescription(text: string): string {
  return normalizeText(text).slice(0, 12_000);
}

export function isValidLinkedInTitle(text: string | null | undefined): boolean {
  const value = normalizeText(text);
  if (value.length < 3 || value.length > 180) return false;
  const lower = value.toLowerCase();
  return !LINKEDIN_UI_NOISE.some((noise) => lower.includes(noise));
}

/** @deprecated alias */
export const isValidLinkedInJobTitle = isValidLinkedInTitle;

export function getLinkedInActiveJobId(doc: Document = document): string | null {
  try {
    const params = new URLSearchParams(doc.defaultView?.location.search ?? '');
    const fromQuery = params.get('currentJobId') ?? params.get('jobId');
    if (fromQuery && /^\d+$/.test(fromQuery)) return fromQuery;
  } catch {
    /* skip */
  }

  const pathMatch = (doc.defaultView?.location.pathname ?? '').match(/\/jobs\/view\/(\d+)/i);
  if (pathMatch?.[1]) return pathMatch[1];

  const selectedCard = getLinkedInSelectedListCard(doc);
  if (selectedCard) {
    const id =
      selectedCard.getAttribute('data-job-id') ??
      selectedCard.closest('[data-job-id]')?.getAttribute('data-job-id') ??
      selectedCard.querySelector('[data-job-id]')?.getAttribute('data-job-id');
    if (id && /^\d+$/.test(id)) return id;
  }

  return null;
}

export function getLinkedInSelectedListCard(doc: Document = document): Element | null {
  const selectors = [
    '.job-card-container--selected[data-job-id]',
    '[data-job-id][aria-selected="true"]',
    '.jobs-search-results-list__list-item--active [data-job-id]',
    '.jobs-search-results__list-item--active [data-job-id]',
    '.scaffold-layout__list-item--selected [data-job-id]',
  ];
  for (const selector of selectors) {
    const hit = doc.querySelector(selector);
    if (!hit) continue;
    return hit.closest('li, [class*="list-item"], .job-card-container') ?? hit;
  }

  const ariaSelected = doc.querySelector('[aria-selected="true"]');
  if (ariaSelected) {
    return ariaSelected.closest('li, [class*="list-item"]') ?? ariaSelected;
  }

  return null;
}

export function getLinkedInJobCardById(
  jobId: string,
  doc: Document = document,
): Element | null {
  const direct =
    doc.querySelector(`[data-job-id="${jobId}"]`) ??
    doc.querySelector(`[data-occludable-job-id="${jobId}"]`) ??
    doc.querySelector(`[data-entity-urn*="${jobId}"]`);
  if (!direct) return null;
  return direct.closest('.jobs-search-results-list__list-item, li, [class*="list-item"]') ?? direct;
}

export function getLinkedInDetailPane(doc: Document = document): Element | null {
  for (const selector of DETAIL_PANE_SELECTORS) {
    try {
      const el = doc.querySelector(selector);
      if (!el) continue;
      const width = el.getBoundingClientRect().width;
      if (width > 100) return el;
    } catch {
      /* skip */
    }
  }
  return null;
}

export function detailPaneHasContent(pane: Element): boolean {
  const titleSelectors = [
    '.job-details-jobs-unified-top-card__job-title h1',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title',
    '.top-card-layout__title',
    'h1',
    'h2',
  ];
  for (const sel of titleSelectors) {
    try {
      const el = pane.querySelector(sel) as HTMLElement | null;
      const text = el?.innerText?.trim() ?? '';
      if (text.length > 3 && text.length < 180 && isValidLinkedInTitle(text)) {
        return true;
      }
    } catch {
      /* skip */
    }
  }

  const descSelectors = [
    '.jobs-description__content',
    '.jobs-description-content__text',
    '#job-details',
    '.description__text',
    '[class*="description__text"]',
    '[class*="jobs-description"]',
  ];
  for (const sel of descSelectors) {
    try {
      const el = pane.querySelector(sel) as HTMLElement | null;
      if (el && el.innerText.trim().length > 50) return true;
    } catch {
      /* skip */
    }
  }

  const allButtons = Array.from(pane.querySelectorAll('button, a[role="button"]'));
  const hasApplyButton = allButtons.some((btn) => {
    const text = (btn.textContent ?? '').toLowerCase().trim();
    return (
      text === 'apply' ||
      text === 'easy apply' ||
      text === 'apply now' ||
      text.startsWith('apply ') ||
      text === 'save'
    );
  });
  if (hasApplyButton) return true;

  return false;
}

export function extractLinkedInTitle(pane: Element): string | null {
  const selectors = [
    '.job-details-jobs-unified-top-card__job-title h1',
    '.job-details-jobs-unified-top-card__job-title',
    '.jobs-unified-top-card__job-title h1',
    '.jobs-unified-top-card__job-title',
    'h1.t-24',
    '.top-card-layout__title',
    'h1',
    'h2',
  ];
  for (const sel of selectors) {
    try {
      const el = pane.querySelector(sel) as HTMLElement | null;
      const text = normalizeText(el?.innerText);
      if (text.length > 2 && isValidLinkedInTitle(text)) return text;
    } catch {
      /* skip */
    }
  }
  return null;
}

export function extractLinkedInListTitle(card: Element): string | null {
  const selectors = [
    '.job-card-list__title',
    '.job-card-list__title-link',
    '.job-card-container__link strong',
    '[class*="job-card-list__title"]',
    'a[data-control-name="job_card_title"]',
    '.artdeco-entity-lockup__title',
    '.base-search-card__title',
  ];
  for (const sel of selectors) {
    try {
      const el = card.querySelector(sel) as HTMLElement | null;
      const text = normalizeText(el?.innerText);
      if (text.length > 2 && isValidLinkedInTitle(text)) return text;
    } catch {
      /* skip */
    }
  }
  return null;
}

export function extractLinkedInCompany(pane: Element): string | null {
  const selectors = [
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__company-name',
    '.jobs-unified-top-card__company-name a',
    '.jobs-unified-top-card__company-name',
    '[data-tracking-control-name="public_jobs_topcard-org-name"]',
    '.topcard__org-name-link',
    '.top-card-layout__second-subline a',
    '[class*="company-name"] a',
    '[class*="company-name"]',
  ];
  for (const sel of selectors) {
    try {
      const el = pane.querySelector(sel) as HTMLElement | null;
      const text = normalizeText(el?.innerText);
      if (text.length > 0 && text.length < 200) return text;
    } catch {
      /* skip */
    }
  }
  return null;
}

export function extractLinkedInListCompany(card: Element): string | null {
  const selectors = [
    '.artdeco-entity-lockup__subtitle',
    '.job-card-container__primary-description',
    '.base-search-card__subtitle',
    '[class*="company-name"]',
  ];
  for (const sel of selectors) {
    try {
      const el = card.querySelector(sel) as HTMLElement | null;
      const text = normalizeText(el?.innerText);
      if (text.length > 1 && text.length < 200) {
        return text.split('·')[0]?.trim() ?? text;
      }
    } catch {
      /* skip */
    }
  }
  return null;
}

function isUsableLogoImg(img: HTMLImageElement): boolean {
  const src = img.currentSrc?.trim() || img.src?.trim() || '';
  if (!src || src.includes('data:')) return false;
  if (src.includes('linkedin.com/favicon')) return false;
  if (src.includes('static.licdn.com/sc/h/')) return false;
  if ((img.alt ?? '').toLowerCase().includes('linkedin')) return false;
  if (img.naturalWidth > 0 && img.naturalWidth < 24) return false;
  return /^https?:\/\//i.test(src);
}

export function extractLinkedInLogo(jobId: string, doc: Document = document): string | null {
  const listCardSelectors = [
    `[data-job-id="${jobId}"] img`,
    `[data-occludable-job-id="${jobId}"] img`,
    `[data-entity-urn*="${jobId}"] img`,
  ];
  for (const sel of listCardSelectors) {
    try {
      for (const img of Array.from(doc.querySelectorAll(sel))) {
        if (img instanceof HTMLImageElement && isUsableLogoImg(img)) {
          return img.currentSrc || img.src;
        }
      }
    } catch {
      /* skip */
    }
  }

  const card = getLinkedInJobCardById(jobId, doc);
  if (card) {
    for (const img of Array.from(
      card.querySelectorAll(
        'img.ivm-view-attr__img--centered, img[class*="company-logo"], img[class*="EntityPhoto"], .job-card-container__company-image img, .artdeco-entity-lockup__image img',
      ),
    )) {
      if (img instanceof HTMLImageElement && isUsableLogoImg(img)) {
        return img.currentSrc || img.src;
      }
    }
  }

  const pane = getLinkedInDetailPane(doc);
  if (pane) {
    const logoSelectors = [
      '.jobs-unified-top-card__company-logo img',
      '.job-details-jobs-unified-top-card img[class*="EntityPhoto"]',
      '.artdeco-entity-lockup__image img',
      '[class*="company-logo"] img',
      '[class*="CompanyLogo"] img',
    ];
    for (const sel of logoSelectors) {
      try {
        const img = pane.querySelector(sel) as HTMLImageElement | null;
        if (img && isUsableLogoImg(img)) return img.currentSrc || img.src;
      } catch {
        /* skip */
      }
    }
  }

  return null;
}

export function extractLinkedInDescription(pane: Element): string | null {
  const selectors = [
    '.jobs-description__content .jobs-box__html-content',
    '.jobs-description__content',
    '#job-details',
    '[class*="description__text"]',
    '[class*="job-description"]',
  ];
  for (const sel of selectors) {
    try {
      const el = pane.querySelector(sel) as HTMLElement | null;
      if (!el) continue;
      const clone = el.cloneNode(true) as HTMLElement;
      clone
        .querySelectorAll('button, [class*="see-more"], [class*="premium"]')
        .forEach((node) => node.remove());
      const text = cleanLinkedInDescription(clone.innerText ?? '');
      if (text.length >= 80) return text;
    } catch {
      /* skip */
    }
  }
  return null;
}

function mapLinkedInExperience(raw: string): string | null {
  const value = raw.trim();
  if (/entry/i.test(value)) return 'Entry';
  if (/mid/i.test(value)) return 'Mid';
  if (/senior/i.test(value)) return 'Senior';
  if (/director|executive/i.test(value)) return 'Executive';
  return normalizeText(value) || null;
}

export function extractFromLinkedIn(): ExtractedJob | null {
  if (!window.location.hostname.includes('linkedin.com')) return null;
  if (!window.location.pathname.includes('/jobs')) return null;

  const jobId = getLinkedInActiveJobId();
  if (!jobId) return null;

  const pane = getLinkedInDetailPane();
  if (!pane) return null;

  if (!detailPaneHasContent(pane)) return null;

  const listCard = getLinkedInJobCardById(jobId);

  let title = extractLinkedInTitle(pane);
  if (!title && listCard) {
    title = extractLinkedInListTitle(listCard);
  }
  if (!title) return null;

  let company = extractLinkedInCompany(pane);
  if (!company && listCard) {
    company = extractLinkedInListCompany(listCard);
  }

  const description = extractLinkedInDescription(pane);
  const logoCandidateUrl = extractLinkedInLogo(jobId);

  const locationEl = pane.querySelector(
    '.job-details-jobs-unified-top-card__primary-description-without-tagline, .jobs-unified-top-card__bullet, .topcard__flavor--bullet',
  ) as HTMLElement | null;
  const location = normalizeText(locationEl?.innerText) || '';

  const insightEls = pane.querySelectorAll(
    '.job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__job-insight',
  );
  let jobType: string | null = null;
  let experienceLevel: string | null = null;
  for (const el of Array.from(insightEls)) {
    const text = normalizeText((el as HTMLElement).innerText).toLowerCase();
    if (!jobType) {
      if (text.includes('full-time') || text.includes('full time')) jobType = 'Full-time';
      else if (text.includes('part-time') || text.includes('part time')) jobType = 'Part-time';
      else if (text.includes('contract')) jobType = 'Contract';
      else if (text.includes('internship') || text.includes('intern')) jobType = 'Internship';
    }
    if (!experienceLevel && /entry level|mid-senior level|director|executive/i.test(text)) {
      experienceLevel = mapLinkedInExperience(text);
    }
  }

  const postedEl = pane.querySelector(
    '.job-details-jobs-unified-top-card__posted-date, .jobs-unified-top-card__posted-date',
  ) as HTMLElement | null;
  const postedDate = normalizeText(postedEl?.innerText) || null;

  const salaryEl = pane.querySelector(
    '.job-details-jobs-unified-top-card__job-insight--highlight',
  ) as HTMLElement | null;
  const salary = normalizeText(salaryEl?.innerText) || null;

  const confidence: ExtractedJob['confidence'] =
    title && company && description ? 'high' : title && company ? 'medium' : 'low';

  return {
    title,
    company: company ?? '',
    location,
    description: description ?? '',
    salary,
    jobType: normaliseJobType(jobType),
    experienceLevel,
    postedDate,
    sourceUrl: window.location.href,
    sourceSite: 'linkedin.com',
    confidence,
    extractedBy: 'site-extractor',
    ...(logoCandidateUrl ? { logoCandidateUrl, logoSource: 'site-extractor' as const } : {}),
  };
}

export async function waitForLinkedInDetailPane(
  _jobId: string,
  callback: () => void,
  timeoutMs = 6000,
): Promise<void> {
  const startTime = Date.now();
  let intervalMs = 300;

  const attempt = async (): Promise<void> => {
    if (Date.now() - startTime >= timeoutMs) {
      callback();
      return;
    }

    const pane = getLinkedInDetailPane();
    if (pane && detailPaneHasContent(pane)) {
      callback();
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
    intervalMs = Math.min(intervalMs * 1.15, 800);
    await attempt();
  };

  const pane = getLinkedInDetailPane();
  if (pane && detailPaneHasContent(pane)) {
    callback();
    return;
  }

  await attempt();
}

export function isLinkedInJobsPage(url: string = window.location.href): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('linkedin.com') && parsed.pathname.includes('/jobs');
  } catch {
    return false;
  }
}
