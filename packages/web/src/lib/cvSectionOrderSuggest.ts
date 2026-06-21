import type { CVSectionRecord } from '@/lib/api';
import { professionalSectionRank } from '@/lib/cvSectionProfessionalOrder';
import { queryKeys } from '@/lib/queryKeys';

export type CvCareerStage = 'student' | 'early' | 'mid' | 'senior';

export type CvSectionOrderIndustry =
  | 'general'
  | 'technology'
  | 'healthcare'
  | 'academic'
  | 'creative';

export type CvSectionOrderChange = {
  sectionId: string;
  type: string;
  label: string;
  fromPosition: number;
  toPosition: number;
  explanation: string;
};

export type CvSectionOrderSuggestResult = {
  careerStage: CvCareerStage;
  industry: CvSectionOrderIndustry;
  industryLabel: string;
  currentOrder: string[];
  suggestedOrder: string[];
  isOptimal: boolean;
  /** Alias for `isOptimal` from newer suggest-order responses. */
  alreadyOrdered?: boolean;
  showProactiveSuggestion: boolean;
  overview: string;
  changes: CvSectionOrderChange[];
};

const SECTION_TYPE_LABELS: Record<string, string> = {
  personal: 'Personal details',
  links: 'Links',
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  languages: 'Languages',
  achievements: 'Achievements',
  references: 'References',
  volunteering: 'Volunteering',
  interests: 'Interests',
  publications: 'Publications',
};

export function cvSectionOrderSuggestQueryKey(profileId: string) {
  return queryKeys.cv.sectionOrderSuggest(profileId);
}

export function sectionOrderBannerDismissedKey(profileId: string) {
  return `applymate:cv:section-order-banner-dismissed:${profileId.trim()}`;
}

export function readSectionOrderBannerDismissed(profileId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(sectionOrderBannerDismissedKey(profileId)) === '1';
  } catch {
    return false;
  }
}

export function writeSectionOrderBannerDismissed(profileId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(sectionOrderBannerDismissedKey(profileId), '1');
  } catch {
    /* ignore */
  }
}

export function sectionDisplayLabel(row: CVSectionRecord): string {
  const tl = row.type.toLowerCase();
  if (tl.startsWith('custom_')) {
    const title = row.data?.title;
    return typeof title === 'string' && title.trim() ? title.trim() : 'Custom section';
  }
  if (tl === 'custom') return 'Custom section';
  return SECTION_TYPE_LABELS[tl] ?? tl.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function labelForSectionId(
  sectionId: string,
  sections: CVSectionRecord[],
  changes: CvSectionOrderChange[],
): string {
  const fromChange = changes.find((c) => c.sectionId === sectionId)?.label?.trim();
  if (fromChange) return fromChange;
  const row = sections.find((s) => s.id === sectionId);
  if (row) return sectionDisplayLabel(row);
  return 'Section';
}

/** Visible row ids from suggest response; hidden rows stay at the tail of `suggestedOrder`. */
export function splitSuggestedOrder(
  currentOrder: string[],
  suggestedOrder: string[],
): { visible: string[]; hiddenTail: string[] } {
  const visibleSet = new Set(currentOrder);
  const visible = suggestedOrder.filter((id) => visibleSet.has(id));
  const hiddenTail = suggestedOrder.filter((id) => !visibleSet.has(id));
  const missingVisible = currentOrder.filter((id) => !visible.includes(id));
  return {
    visible: [...visible, ...missingVisible],
    hiddenTail,
  };
}

function parseCareerStage(v: unknown): CvCareerStage {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (s === 'student' || s === 'early' || s === 'mid' || s === 'senior') return s;
  return 'mid';
}

function parseIndustry(v: unknown): CvSectionOrderIndustry {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (
    s === 'general' ||
    s === 'technology' ||
    s === 'healthcare' ||
    s === 'academic' ||
    s === 'creative'
  ) {
    return s;
  }
  return 'general';
}

function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

function normalizeChange(raw: unknown): CvSectionOrderChange | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const sectionId = typeof o.sectionId === 'string' ? o.sectionId.trim() : '';
  if (!sectionId) return null;
  return {
    sectionId,
    type: typeof o.type === 'string' ? o.type : '',
    label: typeof o.label === 'string' ? o.label : '',
    fromPosition: typeof o.fromPosition === 'number' ? o.fromPosition : 0,
    toPosition: typeof o.toPosition === 'number' ? o.toPosition : 0,
    explanation: typeof o.explanation === 'string' ? o.explanation : '',
  };
}

export function normalizeCvSectionOrderSuggestResult(raw: unknown): CvSectionOrderSuggestResult {
  const o =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const nested =
    o.data !== null && typeof o.data === 'object' && !Array.isArray(o.data)
      ? (o.data as Record<string, unknown>)
      : o;
  const changesRaw = nested.changes ?? o.changes;
  const changes = Array.isArray(changesRaw)
    ? changesRaw
        .map((x) => normalizeChange(x))
        .filter((x): x is CvSectionOrderChange => x !== null)
    : [];
  return {
    careerStage: parseCareerStage(nested.careerStage ?? o.careerStage),
    industry: parseIndustry(nested.industry ?? o.industry),
    industryLabel:
      typeof nested.industryLabel === 'string'
        ? nested.industryLabel
        : typeof o.industryLabel === 'string'
          ? o.industryLabel
          : 'General',
    currentOrder: parseStringArray(nested.currentOrder ?? o.currentOrder),
    suggestedOrder: parseStringArray(nested.suggestedOrder ?? o.suggestedOrder),
    isOptimal:
      nested.isOptimal === true ||
      o.isOptimal === true ||
      nested.alreadyOrdered === true ||
      o.alreadyOrdered === true,
    showProactiveSuggestion:
      nested.showProactiveSuggestion === true || o.showProactiveSuggestion === true,
    overview:
      typeof nested.overview === 'string'
        ? nested.overview
        : typeof o.overview === 'string'
          ? o.overview
          : '',
    changes,
  };
}

export function changeBySectionId(
  changes: CvSectionOrderChange[],
  sectionId: string,
): CvSectionOrderChange | undefined {
  return changes.find((c) => c.sectionId === sectionId);
}

/** Visible section row ids in persisted order. */
export function currentVisibleSectionOrderIds(sections: CVSectionRecord[]): string[] {
  return [...sections]
    .filter((s) => s.hidden !== true)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id)))
    .map((s) => s.id);
}

/** True when visible rows already match the server's suggested order. */
export function sectionOrderMatchesSuggested(
  sections: CVSectionRecord[],
  suggestedOrder: string[],
): boolean {
  if (!suggestedOrder.length || !sections.length) return false;
  const current = currentVisibleSectionOrderIds(sections);
  const { visible } = splitSuggestedOrder(current, suggestedOrder);
  if (visible.length !== current.length) return false;
  return visible.every((id, index) => current[index] === id);
}

/** True when visible section rows are not in canonical professional type order. */
export function sectionsOrderIsSuboptimal(sections: CVSectionRecord[]): boolean {
  const visible = [...sections]
    .filter((s) => s.hidden !== true)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id)));
  let lastRank = -1;
  for (const row of visible) {
    const rank = professionalSectionRank(row.type);
    if (rank < lastRank) return true;
    lastRank = rank;
  }
  return false;
}

/** Client-side fallback when the suggest API incorrectly reports `isOptimal: true`. Kept as a safety net after backend fix (2026-06-04). */
export function buildClientSectionOrderSuggest(
  sections: CVSectionRecord[],
): CvSectionOrderSuggestResult | null {
  if (!sections.length || !sectionsOrderIsSuboptimal(sections)) return null;

  const visible = [...sections]
    .filter((s) => s.hidden !== true)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id)));
  const hidden = [...sections]
    .filter((s) => s.hidden === true)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.id.localeCompare(b.id)));

  const currentOrder = visible.map((s) => s.id);
  const suggestedVisible = [...visible].sort((a, b) => {
    const ra = professionalSectionRank(a.type);
    const rb = professionalSectionRank(b.type);
    if (ra !== rb) return ra - rb;
    return a.order - b.order;
  });
  const suggestedOrder = [...suggestedVisible.map((s) => s.id), ...hidden.map((s) => s.id)];

  const changes: CvSectionOrderChange[] = [];
  suggestedVisible.forEach((row, toPos) => {
    const fromPos = currentOrder.indexOf(row.id);
    if (fromPos >= 0 && fromPos !== toPos) {
      changes.push({
        sectionId: row.id,
        type: row.type,
        label: sectionDisplayLabel(row),
        fromPosition: fromPos,
        toPosition: toPos,
        explanation: 'Align with standard professional CV section flow.',
      });
    }
  });

  return {
    careerStage: 'mid',
    industry: 'general',
    industryLabel: '',
    currentOrder,
    suggestedOrder,
    isOptimal: false,
    showProactiveSuggestion: true,
    overview:
      'Some sections appear out of the usual professional order. Reordering can improve readability for recruiters.',
    changes,
  };
}

export function mergeSectionOrderSuggestWithClientFallback(
  apiResult: CvSectionOrderSuggestResult | null | undefined,
  sections: CVSectionRecord[],
): CvSectionOrderSuggestResult | null {
  const client = buildClientSectionOrderSuggest(sections);
  if (!apiResult) return client;
  if (apiResult.isOptimal) return apiResult;
  if (sectionOrderMatchesSuggested(sections, apiResult.suggestedOrder)) {
    return {
      ...apiResult,
      isOptimal: true,
      showProactiveSuggestion: false,
    };
  }
  if (!apiResult.isOptimal) return apiResult;
  return client ?? apiResult;
}
