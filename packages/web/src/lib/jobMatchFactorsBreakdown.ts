export type JobMatchFactorKey =
  | 'skillsMatch'
  | 'experienceMatch'
  | 'keywordCoverage'
  | 'seniorityAlignment'
  | 'industryRelevance'
  | 'evidenceStrength';

export type JobMatchFactor = {
  key: JobMatchFactorKey;
  label: string;
  score: number;
  explanation: string;
  hint?: string;
  /** Second paragraph for gap copy — render separately from `explanation`. */
  missingExplanation?: string;
  found?: string[];
  missing?: string[];
  /** Literal keyword hits (keywordCoverage row). */
  foundCount?: number;
  totalCount?: number;
  /** Skills AI marked found but not verbatim on CV. */
  semanticOnlyItems?: string[];
};

export type JobMatchFactorsBreakdown = {
  factors: JobMatchFactor[];
};

const FACTOR_ORDER: JobMatchFactorKey[] = [
  'skillsMatch',
  'experienceMatch',
  'keywordCoverage',
  'seniorityAlignment',
  'industryRelevance',
  'evidenceStrength',
];

const DEFAULT_LABELS: Record<JobMatchFactorKey, string> = {
  skillsMatch: 'Skills match',
  experienceMatch: 'Experience match',
  keywordCoverage: 'Keyword coverage',
  seniorityAlignment: 'Seniority alignment',
  industryRelevance: 'Industry relevance',
  evidenceStrength: 'Evidence strength',
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseFactorKey(raw: unknown): JobMatchFactorKey | null {
  if (typeof raw !== 'string') return null;
  const k = raw.trim();
  const map: Record<string, JobMatchFactorKey> = {
    skillsMatch: 'skillsMatch',
    skills_match: 'skillsMatch',
    experienceMatch: 'experienceMatch',
    experience_match: 'experienceMatch',
    keywordCoverage: 'keywordCoverage',
    keyword_coverage: 'keywordCoverage',
    seniorityAlignment: 'seniorityAlignment',
    seniority_alignment: 'seniorityAlignment',
    industryRelevance: 'industryRelevance',
    industry_relevance: 'industryRelevance',
    evidenceStrength: 'evidenceStrength',
    evidence_strength: 'evidenceStrength',
  };
  return map[k] ?? null;
}

function parseStringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function stripAnalysisCopyEmDash(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseFactorItem(raw: unknown): JobMatchFactor | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const key =
    parseFactorKey(o.key) ??
    parseFactorKey(o.factor) ??
    parseFactorKey(o.id);
  if (!key) return null;

  const scoreRaw = o.score ?? o.percent ?? o.value;
  const scoreNum =
    typeof scoreRaw === 'number'
      ? scoreRaw
      : typeof scoreRaw === 'string'
        ? parseFloat(scoreRaw)
        : Number(scoreRaw);
  if (!Number.isFinite(scoreNum)) return null;

  const label = stripAnalysisCopyEmDash(
    (typeof o.label === 'string' && o.label.trim()) || DEFAULT_LABELS[key],
  );
  const explanation = stripAnalysisCopyEmDash(
    (typeof o.explanation === 'string' && o.explanation.trim()) ||
      (typeof o.summary === 'string' && o.summary.trim()) ||
      (typeof o.detail === 'string' && o.detail.trim()) ||
      '',
  );
  const hintRaw =
    (typeof o.hint === 'string' && o.hint.trim()) ||
    (typeof o.tooltip === 'string' && o.tooltip.trim()) ||
    undefined;
  const hint = hintRaw ? stripAnalysisCopyEmDash(hintRaw) : undefined;
  const missingExplanationRaw =
    (typeof o.missingExplanation === 'string' && o.missingExplanation.trim()) ||
    (typeof o.missing_explanation === 'string' && o.missing_explanation.trim()) ||
    undefined;
  const missingExplanation = missingExplanationRaw
    ? stripAnalysisCopyEmDash(missingExplanationRaw)
    : undefined;

  const foundCountRaw = o.foundCount ?? o.found_count;
  const totalCountRaw = o.totalCount ?? o.total_count;
  const foundCount =
    typeof foundCountRaw === 'number' && Number.isFinite(foundCountRaw)
      ? Math.max(0, Math.round(foundCountRaw))
      : undefined;
  const totalCount =
    typeof totalCountRaw === 'number' && Number.isFinite(totalCountRaw)
      ? Math.max(0, Math.round(totalCountRaw))
      : undefined;

  const semanticOnlyItems = parseStringList(
    o.semanticOnlyItems ?? o.semantic_only_items,
  );

  const found = parseStringList(o.found ?? o.foundSkills ?? o.found_keywords) ?? [];
  const missing = parseStringList(o.missing ?? o.missingSkills ?? o.missing_keywords) ?? [];

  return {
    key,
    label,
    score: clampScore(scoreNum),
    explanation,
    hint,
    missingExplanation,
    ...(found.length > 0 ? { found } : {}),
    ...(missing.length > 0 ? { missing } : {}),
    ...(foundCount !== undefined ? { foundCount } : {}),
    ...(totalCount !== undefined ? { totalCount } : {}),
    ...(semanticOnlyItems ? { semanticOnlyItems } : {}),
  };
}

/** Parse API `factorsBreakdown` (camelCase or snake_case). */
export function parseJobMatchFactorsBreakdown(
  raw: unknown,
): JobMatchFactorsBreakdown | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const list = o.factors ?? o.factor_rows ?? o.factorRows;
  if (!Array.isArray(list)) return null;

  const byKey = new Map<JobMatchFactorKey, JobMatchFactor>();
  for (const item of list) {
    const parsed = parseFactorItem(item);
    if (parsed) byKey.set(parsed.key, parsed);
  }
  if (byKey.size === 0) return null;

  const factors = FACTOR_ORDER.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!);
  for (const [k, f] of byKey) {
    if (!factors.some((x) => x.key === k)) factors.push(f);
  }

  return { factors };
}

export function factorBarColor(score: number): string {
  if (score >= 70) return 'bg-[#10B981]';
  if (score >= 40) return 'bg-[#F59E0B]';
  return 'bg-[#EF4444]';
}

export function factorTextColor(score: number): string {
  if (score >= 70) return 'text-[#34d399]';
  if (score >= 40) return 'text-[#fbbf24]';
  return 'text-[#f87171]';
}

/** Split comma-separated skill/requirement lists (attack plan display only — not factor chips). */
export function splitFactorListItems(raw: string): string[] {
  const trimmed = raw.trim().replace(/\.$/, '');
  if (!trimmed || trimmed === '—' || trimmed === '-' || trimmed === '—.') return [];
  return trimmed
    .split(/,\s+(?=[\p{L}\p{N}])/u)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter(Boolean);
}

export function factorByKey(
  breakdown: JobMatchFactorsBreakdown | null | undefined,
  key: JobMatchFactorKey,
): JobMatchFactor | null {
  return breakdown?.factors.find((f) => f.key === key) ?? null;
}

/** Log when API returns green chips but a 0% factor score (stale or inconsistent row). */
export function warnFactorScoreInconsistency(factor: JobMatchFactor): void {
  const foundCount = factor.found?.length ?? 0;
  if (foundCount > 0 && factor.score === 0) {
    console.warn(
      `[MatchScoreFactorsBreakdown] Inconsistent data: factor "${factor.key}" has ${foundCount} found items but score is 0%. Re-analyze this job if the UI looks wrong.`,
    );
  }
}

export type ResolvedFactorSkillLists = {
  summary: string;
  found: string[];
  missing: string[];
};

/** Chip lists come from API `found` / `missing` only — never parse `explanation` prose. */
export function resolveFactorSkillLists(factor: JobMatchFactor): ResolvedFactorSkillLists {
  const dedupe = (items: string[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  return {
    summary: factor.explanation?.trim() ?? '',
    found: dedupe(factor.found ?? []),
    missing: dedupe(factor.missing ?? []),
  };
}

export function factorMissingExplanationLabel(key: JobMatchFactorKey): string {
  switch (key) {
    case 'keywordCoverage':
      return 'Semantic fit vs exact wording';
    default:
      return 'Additional context';
  }
}

/** Chip group labels per factor — skills vs keyword coverage use distinct copy from backend handoff. */
export function factorChipCopy(key: JobMatchFactorKey): {
  foundLabel: string;
  missingLabel: string;
  foundCountLabel: (count: number) => string;
  missingCountLabel: (count: number) => string;
} {
  switch (key) {
    case 'skillsMatch':
      return {
        foundLabel: 'Tools demonstrated on your CV',
        missingLabel: 'Tools not demonstrated on your CV',
        foundCountLabel: (n) => `${n} on CV`,
        missingCountLabel: (n) => `${n} missing`,
      };
    case 'keywordCoverage':
      return {
        foundLabel: 'Exact phrases found in your CV',
        missingLabel: 'Exact phrases missing from your CV',
        foundCountLabel: (n) => `${n} matched`,
        missingCountLabel: (n) => `${n} missing`,
      };
    default:
      return {
        foundLabel: 'On your CV',
        missingLabel: 'Missing from CV',
        foundCountLabel: (n) => `${n} on CV`,
        missingCountLabel: (n) => `${n} missing`,
      };
  }
}
