/**
 * Optional ATS simulation report on `breakdown.ats.simulation` (Phase 6 — additive API).
 * Shape is defensive: unknown keys are ignored; callers branch on `simulation != null`.
 */

export type AtsDimensionBucket = {
  score0to100: number;
  weight: number;
  contribution: number;
};

export type AtsKeywordBucket = {
  present: string[];
  missing: string[];
};

export type AtsHardSkillMatch = {
  term?: string;
  canonical?: string;
  matched?: boolean;
};

export type AtsSimulationReport = {
  overallScore?: number;
  coveragePercent?: number;
  dimensions?: Record<string, AtsDimensionBucket>;
  keywords?: {
    required?: AtsKeywordBucket;
    preferred?: AtsKeywordBucket;
    niceToHave?: AtsKeywordBucket;
  };
  hardSkillMatches?: AtsHardSkillMatch[];
  titleAlignmentScore?: number;
  seniorityAlignmentScore?: number;
  semanticSimilarityScore?: number;
  formattingParseabilityScore?: number;
  quantifiedAchievementsScore?: number;
  sectionCompletenessScore?: number;
  recommendations?: string[];
};

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : String(x)))
    .filter((s) => s.length > 0);
}

function parseKeywordBucket(raw: unknown): AtsKeywordBucket | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  return {
    present: strList(o.present),
    missing: strList(o.missing),
  };
}

function parseDimensions(raw: unknown): Record<string, AtsDimensionBucket> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const out: Record<string, AtsDimensionBucket> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
    const o = val as Record<string, unknown>;
    const score =
      num(o.score0to100) ??
      num(o.score0To100) ??
      num(o.score) ??
      num((o as { score_0_to_100?: unknown }).score_0_to_100);
    const weight = num(o.weight) ?? 0;
    const contribution = num(o.contribution) ?? 0;
    if (score === undefined) continue;
    out[key] = {
      score0to100: Math.round(Math.min(100, Math.max(0, score))),
      weight,
      contribution,
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseHardSkillMatches(raw: unknown): AtsHardSkillMatch[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: AtsHardSkillMatch[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    out.push({
      term: typeof o.term === 'string' ? o.term : undefined,
      canonical: typeof o.canonical === 'string' ? o.canonical : undefined,
      matched: o.matched === true ? true : o.matched === false ? false : undefined,
    });
  }
  return out.length > 0 ? out : undefined;
}

/** Best-effort parse of `ats.simulation` from score breakdown JSON. */
export function parseAtsSimulationReport(raw: unknown): AtsSimulationReport | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  const keywordsRaw = src.keywords ?? src.keyword_groups;
  let keywords: AtsSimulationReport['keywords'];
  if (keywordsRaw && typeof keywordsRaw === 'object' && !Array.isArray(keywordsRaw)) {
    const k = keywordsRaw as Record<string, unknown>;
    keywords = {
      required: parseKeywordBucket(k.required),
      preferred: parseKeywordBucket(k.preferred),
      niceToHave: parseKeywordBucket(k.niceToHave ?? k.nice_to_have),
    };
    if (!keywords.required && !keywords.preferred && !keywords.niceToHave) keywords = undefined;
  }

  const out: AtsSimulationReport = {
    overallScore: num(src.overallScore ?? src.overall_score),
    coveragePercent: num(src.coveragePercent ?? src.coverage_percent),
    dimensions: parseDimensions(src.dimensions),
    keywords,
    hardSkillMatches: parseHardSkillMatches(src.hardSkillMatches ?? src.hard_skill_matches),
    titleAlignmentScore: num(src.titleAlignmentScore ?? src.title_alignment_score),
    seniorityAlignmentScore: num(src.seniorityAlignmentScore ?? src.seniority_alignment_score),
    semanticSimilarityScore: num(src.semanticSimilarityScore ?? src.semantic_similarity_score),
    formattingParseabilityScore: num(src.formattingParseabilityScore ?? src.formatting_parseability_score),
    quantifiedAchievementsScore: num(src.quantifiedAchievementsScore ?? src.quantified_achievements_score),
    sectionCompletenessScore: num(src.sectionCompletenessScore ?? src.section_completeness_score),
    recommendations: strList(src.recommendations),
  };

  const hasAny =
    out.overallScore !== undefined ||
    out.coveragePercent !== undefined ||
    (out.dimensions && Object.keys(out.dimensions).length > 0) ||
    out.keywords ||
    (out.hardSkillMatches && out.hardSkillMatches.length > 0) ||
    out.titleAlignmentScore !== undefined ||
    out.seniorityAlignmentScore !== undefined ||
    out.semanticSimilarityScore !== undefined ||
    out.formattingParseabilityScore !== undefined ||
    out.quantifiedAchievementsScore !== undefined ||
    out.sectionCompletenessScore !== undefined ||
    (out.recommendations && out.recommendations.length > 0);

  return hasAny ? out : undefined;
}

function normDimKey(k: string): string {
  return k.toLowerCase().replace(/[_\s-]/g, '');
}

/** First dimension whose normalized key contains any of `fragments`. */
export function dimensionScoreByHint(
  dimensions: Record<string, AtsDimensionBucket> | undefined,
  fragments: string[],
): number | undefined {
  if (!dimensions) return undefined;
  for (const [key, bucket] of Object.entries(dimensions)) {
    const nk = normDimKey(key);
    if (fragments.some((f) => nk.includes(normDimKey(f)))) return bucket.score0to100;
  }
  return undefined;
}
