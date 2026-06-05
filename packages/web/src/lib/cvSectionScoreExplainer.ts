import type { CVFlag, CVImprovementItem, SectionScore } from '@/lib/api';

/** Per-section score explainer from GET/POST score breakdown (3.2). */
export type CvSectionScoreExplainer = {
  whatItMeans: string;
  whyThisScore: string;
  howToImprove: string;
  suggestionId?: string;
};

export type CvSectionScoreKey =
  | 'contact'
  | 'experience'
  | 'education'
  | 'skills'
  | 'summary'
  | 'formatting'
  | 'jobMatch';

const SECTION_LABELS: Record<CvSectionScoreKey, string> = {
  contact: 'Contact',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  summary: 'Summary',
  formatting: 'Formatting',
  jobMatch: 'Job match',
};

export function cvSectionLabel(key: CvSectionScoreKey): string {
  return SECTION_LABELS[key] ?? key;
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function parseCvSectionScoreExplainer(raw: unknown): CvSectionScoreExplainer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const nested = o.explainer ?? o.scoreExplainer ?? o.score_explainer;
  const src =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : o;

  const whatItMeans =
    pickString(src.whatItMeans ?? src.what_it_means ?? src.meaning) ?? '';
  const whyThisScore =
    pickString(src.whyThisScore ?? src.why_this_score ?? src.why) ?? '';
  const howToImprove =
    pickString(src.howToImprove ?? src.how_to_improve ?? src.improve) ?? '';
  const suggestionId =
    pickString(src.suggestionId ?? src.suggestion_id ?? src.primarySuggestionId) ??
    undefined;

  if (!whatItMeans && !whyThisScore && !howToImprove) return null;

  return {
    whatItMeans:
      whatItMeans ||
      'This score shows how strong this part of your CV looks to recruiters and screening software.',
    whyThisScore: whyThisScore || 'Your current content triggered rubric checks for this section.',
    howToImprove:
      howToImprove || 'Add clearer, role-relevant detail with measurable outcomes where you can.',
    ...(suggestionId ? { suggestionId } : {}),
  };
}

export type ParsedSectionScore = SectionScore & {
  explainer?: CvSectionScoreExplainer | null;
};

export function parseSectionScoreWithExplainer(raw: unknown): ParsedSectionScore {
  const explainer = parseCvSectionScoreExplainer(raw);
  let base: SectionScore;
  if (
    raw !== null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'score' in (raw as object)
  ) {
    const o = raw as Record<string, unknown>;
    const sc = Number(o.score);
    const w = o.weight !== undefined ? Number(o.weight) : NaN;
    const flags: CVFlag[] = Array.isArray(o.flags)
      ? (o.flags as unknown[]).filter(
          (f): f is CVFlag => f !== null && typeof f === 'object',
        )
      : [];
    base = {
      score: Number.isFinite(sc) ? Math.round(sc) : 0,
      weight: Number.isFinite(w) ? w : 0,
      feedback: typeof o.feedback === 'string' ? o.feedback : '',
      flags,
      ...(explainer ? { explainer } : {}),
    };
  } else if (typeof raw === 'number' && Number.isFinite(raw)) {
    base = { score: Math.round(raw), weight: 0, feedback: '', flags: [] };
  } else {
    base = { score: 0, weight: 0, feedback: '', flags: [] };
  }
  return explainer ? { ...base, explainer } : base;
}

/** Build explainer copy when API only sends `feedback` + flags (legacy / partial payloads). */
export function buildSectionExplainerFallback(
  section: SectionScore,
  sectionKey: CvSectionScoreKey,
  improvements: CVImprovementItem[] = [],
): CvSectionScoreExplainer | null {
  if (section.explainer) return section.explainer;

  const label = cvSectionLabel(sectionKey).toLowerCase();
  const feedback = section.feedback?.trim() ?? '';
  const flagFix =
    section.flags?.find((f) => typeof f.fix === 'string' && f.fix.trim())?.fix?.trim() ??
    section.flags?.find((f) => typeof f.message === 'string' && f.message.trim())?.message?.trim() ??
    '';

  const sectionNorm = sectionKey === 'jobMatch' ? 'jobmatch' : sectionKey.toLowerCase();
  const matched = improvements.find((item) => {
    const s = (item.section ?? '').trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return false;
    return s === sectionNorm || s.includes(sectionNorm) || sectionNorm.includes(s);
  });
  const suggestionId = matched?.id?.trim();

  if (!feedback && !flagFix && !matched) return null;

  return {
    whatItMeans: `This score reflects how complete and convincing your ${label} section looks on a quick recruiter scan.`,
    whyThisScore:
      feedback ||
      matched?.issue?.trim() ||
      matched?.message?.trim() ||
      'A few rubric checks lowered this section.',
    howToImprove:
      matched?.suggestion?.trim() ||
      flagFix ||
      'Add specific outcomes, tools, and scope so this section reads credible at a glance.',
    ...(suggestionId ? { suggestionId } : {}),
  };
}

export function parseBreakdownSectionExplainers(
  breakdown: Record<string, unknown> | undefined,
): Partial<Record<CvSectionScoreKey, CvSectionScoreExplainer>> {
  if (!breakdown) return {};
  const root =
    breakdown.sectionExplainers ??
    breakdown.section_explainers ??
    breakdown.scoreExplainers ??
    breakdown.score_explainers;
  if (!root || typeof root !== 'object' || Array.isArray(root)) return {};
  const out: Partial<Record<CvSectionScoreKey, CvSectionScoreExplainer>> = {};
  for (const key of Object.keys(SECTION_LABELS) as CvSectionScoreKey[]) {
    const parsed = parseCvSectionScoreExplainer((root as Record<string, unknown>)[key]);
    if (parsed) out[key] = parsed;
  }
  return out;
}
