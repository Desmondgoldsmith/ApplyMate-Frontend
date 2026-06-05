export type JobMatchFactorKey =
  | 'skillsMatch'
  | 'experienceMatch'
  | 'keywordCoverage'
  | 'seniorityAlignment'
  | 'industryRelevance';

export type JobMatchFactor = {
  key: JobMatchFactorKey;
  label: string;
  score: number;
  explanation: string;
  found?: string[];
  missing?: string[];
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
];

const DEFAULT_LABELS: Record<JobMatchFactorKey, string> = {
  skillsMatch: 'Skills match',
  experienceMatch: 'Experience match',
  keywordCoverage: 'Keyword coverage',
  seniorityAlignment: 'Seniority alignment',
  industryRelevance: 'Industry relevance',
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

  const label =
    (typeof o.label === 'string' && o.label.trim()) || DEFAULT_LABELS[key];
  const explanation =
    (typeof o.explanation === 'string' && o.explanation.trim()) ||
    (typeof o.summary === 'string' && o.summary.trim()) ||
    (typeof o.detail === 'string' && o.detail.trim()) ||
    '';

  return {
    key,
    label,
    score: clampScore(scoreNum),
    explanation,
    found: parseStringList(o.found ?? o.foundSkills ?? o.found_keywords),
    missing: parseStringList(o.missing ?? o.missingSkills ?? o.missing_keywords),
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
