import type { CVScorePayload } from '@/lib/api';

export type CvScoringMethod = 'hybrid' | 'rubric_only';

export type CvAtsMode = 'ai' | 'heuristic';

export type CvScoringTransparencyMethod = {
  title: string;
  short: string;
};

export type CvScoringTransparency = {
  headline: string;
  methods: {
    hybrid: CvScoringTransparencyMethod;
    rubric_only: CvScoringTransparencyMethod;
  };
  structural: { title: string; short: string };
  ai: { title: string; short: string };
  weights: {
    structuralPercent: number;
    aiPercent: number;
    short: string;
  };
  cache: { title: string; short: string };
  jobContext: { title: string; short: string };
};

export type CvAiAssessmentDimension = {
  score: number;
  note?: string;
};

export type CvAiAssessment = {
  overall?: number;
  summary?: string;
  dimensions?: Record<string, CvAiAssessmentDimension>;
  strengths?: string[];
  improvements?: string[];
};

/** Hybrid CV score metadata from GET/POST score endpoints. */
export type CvHybridScoringMeta = {
  scoringMethod: CvScoringMethod;
  structuralScore: number | null;
  aiScore: number | null;
  aiCached: boolean;
  aiEvaluatedAt?: string;
  aiAssessment: CvAiAssessment | null;
  scoringTransparency: CvScoringTransparency | null;
  /**
   * Whether the AI breakdown (ring + quality dimensions) is present.
   * `false` → render heuristic-only UI and never show an empty AI ring.
   */
  aiBreakdownAvailable: boolean;
  /** Which engine produced the ATS read: AI-assisted or basic heuristic checks. */
  atsMode: CvAtsMode;
};

function pickScore(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(0, Math.min(100, Math.round(v)));
  }
  if (typeof v === 'string' && v.trim()) {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  }
  return null;
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function parseTransparencyMethod(raw: unknown): CvScoringTransparencyMethod | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = pickString(o.title);
  const short = pickString(o.short);
  if (!title || !short) return null;
  return { title, short };
}

function parseTransparency(raw: unknown): CvScoringTransparency | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const headline = pickString(o.headline);
  const methodsRaw = o.methods;
  if (!headline || !methodsRaw || typeof methodsRaw !== 'object') return null;
  const m = methodsRaw as Record<string, unknown>;
  const hybrid = parseTransparencyMethod(m.hybrid);
  const rubricOnly = parseTransparencyMethod(m.rubric_only ?? m.rubricOnly);
  const structural = parseTransparencyBlock(o.structural);
  const ai = parseTransparencyBlock(o.ai);
  const weightsRaw = o.weights;
  const cache = parseTransparencyBlock(o.cache);
  const jobContext = parseTransparencyBlock(o.jobContext ?? o.job_context);
  if (!hybrid || !rubricOnly || !structural || !ai || !cache || !jobContext) return null;
  let structuralPercent = 30;
  let aiPercent = 70;
  let weightsShort = '';
  if (weightsRaw && typeof weightsRaw === 'object') {
    const w = weightsRaw as Record<string, unknown>;
    const sp = pickScore(w.structuralPercent ?? w.structural_percent);
    const ap = pickScore(w.aiPercent ?? w.ai_percent);
    if (sp != null) structuralPercent = sp;
    if (ap != null) aiPercent = ap;
    weightsShort = pickString(w.short) ?? '';
  }
  if (!weightsShort) {
    weightsShort = `Overall combines ${structuralPercent}% of your structure score and ${aiPercent}% of your quality score.`;
  }
  return {
    headline,
    methods: { hybrid, rubric_only: rubricOnly },
    structural,
    ai,
    weights: { structuralPercent, aiPercent, short: weightsShort },
    cache,
    jobContext,
  };
}

function parseTransparencyBlock(raw: unknown): { title: string; short: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const title = pickString(o.title);
  const short = pickString(o.short);
  if (!title || !short) return null;
  return { title, short };
}

function parseAiAssessment(raw: unknown): CvAiAssessment | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const summary = pickString(o.summary);
  const overall = pickScore(o.overall);
  const dimensionsRaw = o.dimensions;
  const dimensions: Record<string, CvAiAssessmentDimension> = {};
  if (dimensionsRaw && typeof dimensionsRaw === 'object' && !Array.isArray(dimensionsRaw)) {
    for (const [key, val] of Object.entries(dimensionsRaw as Record<string, unknown>)) {
      if (!val || typeof val !== 'object') continue;
      const d = val as Record<string, unknown>;
      const score = pickScore(d.score);
      if (score == null) continue;
      dimensions[key] = {
        score,
        note: pickString(d.note),
      };
    }
  }
  const strengths = Array.isArray(o.strengths)
    ? o.strengths.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  const improvements = Array.isArray(o.improvements)
    ? o.improvements.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : [];
  if (
    !summary &&
    overall == null &&
    Object.keys(dimensions).length === 0 &&
    strengths.length === 0 &&
    improvements.length === 0
  ) {
    return null;
  }
  return {
    ...(overall != null ? { overall } : {}),
    ...(summary ? { summary } : {}),
    ...(Object.keys(dimensions).length > 0 ? { dimensions } : {}),
    ...(strengths.length > 0 ? { strengths } : {}),
    ...(improvements.length > 0 ? { improvements } : {}),
  };
}

function parseScoringMethod(raw: unknown, aiScore: number | null): CvScoringMethod | null {
  const m = pickString(raw);
  if (m === 'hybrid' || m === 'rubric_only') return m;
  if (aiScore != null) return 'hybrid';
  if (raw === 'rubric_only' || raw === 'hybrid') return raw;
  return null;
}

/** Parse hybrid scoring fields from an API envelope, breakdown object, or score payload. */
export function parseCvHybridScoring(source: unknown): CvHybridScoringMeta | null {
  if (!source || typeof source !== 'object') return null;
  const o = source as Record<string, unknown>;

  const structuralScore = pickScore(o.structuralScore ?? o.structural_score);
  const aiScore = pickScore(o.aiScore ?? o.ai_score);
  const scoringMethod =
    parseScoringMethod(o.scoringMethod ?? o.scoring_method, aiScore) ??
    (structuralScore != null || aiScore != null ? (aiScore != null ? 'hybrid' : 'rubric_only') : null);

  const scoringTransparency = parseTransparency(
    o.scoringTransparency ?? o.scoring_transparency,
  );
  const aiAssessment = parseAiAssessment(o.aiAssessment ?? o.ai_assessment);

  const hasSignal =
    scoringMethod != null ||
    structuralScore != null ||
    aiScore != null ||
    scoringTransparency != null ||
    aiAssessment != null;

  if (!hasSignal) return null;

  const method: CvScoringMethod =
    scoringMethod ?? (aiScore != null ? 'hybrid' : 'rubric_only');

  const aiBreakdownAvailable = parseAiBreakdownAvailable(o, {
    method,
    aiScore,
    aiAssessment,
  });
  const atsMode = parseAtsMode(o, { method, aiBreakdownAvailable });

  return {
    scoringMethod: method,
    structuralScore,
    aiScore,
    aiCached: o.aiCached === true || o.ai_cached === true,
    aiEvaluatedAt: pickString(o.aiEvaluatedAt ?? o.ai_evaluated_at),
    aiAssessment,
    scoringTransparency,
    aiBreakdownAvailable,
    atsMode,
  };
}

function parseBooleanFlag(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
}

/** Honor explicit `aiBreakdownAvailable` flag; otherwise infer from AI signals. */
function parseAiBreakdownAvailable(
  o: Record<string, unknown>,
  ctx: {
    method: CvScoringMethod;
    aiScore: number | null;
    aiAssessment: CvAiAssessment | null;
  },
): boolean {
  const explicit = parseBooleanFlag(
    o.aiBreakdownAvailable ?? o.ai_breakdown_available,
  );
  if (explicit != null) return explicit;
  if (ctx.method === 'rubric_only') return false;
  return ctx.aiScore != null || ctx.aiAssessment != null;
}

/** Honor explicit `atsMode`; otherwise infer from AI availability. */
function parseAtsMode(
  o: Record<string, unknown>,
  ctx: { method: CvScoringMethod; aiBreakdownAvailable: boolean },
): CvAtsMode {
  const raw = pickString(o.atsMode ?? o.ats_mode)?.toLowerCase();
  if (raw === 'ai' || raw === 'heuristic') return raw;
  return ctx.aiBreakdownAvailable ? 'ai' : 'heuristic';
}

/** Read hybrid fields already normalized on {@link CVScorePayload}. */
export function hybridScoringFromScorePayload(
  payload: CVScorePayload | null | undefined,
): CvHybridScoringMeta | null {
  if (!payload) return null;
  return (
    parseCvHybridScoring(payload) ??
    parseCvHybridScoring(payload.breakdown)
  );
}

export function isAiOriginSuggestionId(id: string | undefined): boolean {
  return Boolean(id?.trim().toLowerCase().startsWith('ai_q_'));
}

/** Human-readable dimension label from API key. */
export function formatAiDimensionLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** One-line blend weights for the score card (percentages from API or defaults). */
export function hybridWeightsSummaryLine(
  structuralPercent: number,
  aiPercent: number,
): string {
  return `${structuralPercent}% structure · ${aiPercent}% quality`;
}

/** Tooltip / explainer for where blend weights come from. */
export function hybridWeightsTooltip(
  structuralPercent: number,
  aiPercent: number,
  apiWeightsShort?: string | null,
): string {
  const fromApi = apiWeightsShort?.trim();
  if (fromApi) {
    return `${fromApi}\n\nOverall ≈ ${structuralPercent}% × structure score + ${aiPercent}% × quality score (each sub-score is out of 100).`;
  }
  return `ApplyMate uses fixed server weights (${structuralPercent}% structure, ${aiPercent}% quality) from scoringTransparency.weights — not your section scores.\n\nOverall ≈ ${structuralPercent}% × structure score + ${aiPercent}% × quality score (each sub-score is out of 100).`;
}

/** Example arithmetic line, e.g. "78 ≈ 30% × 75 + 70% × 79". */
export function hybridOverallFormulaExample(
  structural: number,
  ai: number,
  structuralPercent: number,
  aiPercent: number,
  overallRounded: number,
): string {
  return `${overallRounded} ≈ ${structuralPercent}% × ${structural} + ${aiPercent}% × ${ai}`;
}

/** Compact side-by-side blend, e.g. "Structure 62 · Quality 78 → Overall 73". */
export function hybridBlendCompactLine(
  structural: number,
  ai: number,
  overallRounded: number,
): string {
  return `Structure ${structural} · Quality ${ai} → Overall ${overallRounded}`;
}
