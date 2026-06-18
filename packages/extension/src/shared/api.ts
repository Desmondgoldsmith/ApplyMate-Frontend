import type { CoverLetterRequestPayload } from '@/shared/cover-letter-payload';
import type { CvScoreRequestPayload } from '@/shared/cv-score-payload';
import { parseFactorsBreakdown } from '@/shared/factors-breakdown';
import { getToken } from '@/shared/storage';
import type {
  AiUsageSnapshot,
  CheckResponse,
  CoverLetterResult,
  CvProfile,
  CvScoreResult,
  ExtensionJobState,
  ExtractedJob,
  InitiateTailorPayload,
  SaveJobPayload,
  SavedJob,
  TailorSession,
  User,
} from '@/shared/types';

export class ApiRequestError extends Error {
  statusCode: number;
  code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please log in again via the ApplyMate web app.';

export function isDailyAiLimitError(err: unknown): boolean {
  if (!(err instanceof ApiRequestError)) return false;
  return (
    err.statusCode === 429 ||
    err.code === 'DAILY_LIMIT_REACHED' ||
    err.code === 'QUOTA_EXCEEDED'
  );
}

/** Map API failures to sidebar-friendly copy (analyze / cover letter). */
export function formatExtensionApiError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(err instanceof ApiRequestError)) return fallback;
  if (err.statusCode === 401 || err.code === 'SESSION_EXPIRED') {
    return SESSION_EXPIRED_MESSAGE;
  }
  if (isDailyAiLimitError(err)) {
    return "You've used all your AI actions for today. Resets at midnight.";
  }
  if (err.statusCode === 408 || err.statusCode === 504) {
    return 'Request timed out. The server is taking too long — please try again.';
  }
  return err.message.trim() || fallback;
}

const DEFAULT_API_BASE = 'http://localhost:3000/api';

function resolveApiBase(raw: string | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return DEFAULT_API_BASE;

  const withScheme =
    /^https?:\/\//i.test(trimmed) || /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `http://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_API_BASE;
    }
    return parsed.href.replace(/\/$/, '');
  } catch {
    return DEFAULT_API_BASE;
  }
}

const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL);

function resolveRequestUrl(path: string): string {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('invalid protocol');
    }
    return parsed.href;
  } catch {
    throw new ApiRequestError(
      'API URL is not configured. Set VITE_API_URL in packages/extension/.env',
      0,
    );
  }
}

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: { message?: string; statusCode?: number; code?: string } | null;
};

type ApiFetchOptions = RequestInit;

async function parseApiEnvelope<T>(res: Response): Promise<T> {
  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    if (!res.ok) throw new ApiRequestError(`API error ${res.status}`, res.status);
    throw new ApiRequestError('Invalid API response', res.status);
  }

  if (!res.ok || !body.success) {
    const err = body.error;
    let message = err?.message ?? `API error ${res.status}`;
    if (Array.isArray(message)) {
      message = message.filter((entry) => typeof entry === 'string').join(' ');
    } else if (typeof message !== 'string') {
      message = `API error ${res.status}`;
    }
    throw new ApiRequestError(
      message,
      err?.statusCode ?? res.status,
      typeof err?.code === 'string' ? err.code : undefined,
    );
  }

  return body.data;
}

export async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const token = await getToken();
  const res = await fetch(resolveRequestUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    throw new ApiRequestError(SESSION_EXPIRED_MESSAGE, 401, 'SESSION_EXPIRED');
  }

  return parseApiEnvelope<T>(res);
}

type ApiExtractedJob = Omit<ExtractedJob, 'extractedBy'> & {
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
};

type ExtractJobApiResponse = ApiExtractedJob & {
  fromCache?: boolean;
  aiUsage?: AiUsageSnapshot;
};

export type ExtractJobResult = {
  job: ExtractedJob;
  fromCache: boolean;
  aiUsage?: AiUsageSnapshot;
};

function mapApiExtractedJob(data: ApiExtractedJob): ExtractedJob {
  return {
    title: data.title?.trim() ?? '',
    company: data.company?.trim() ?? '',
    location: data.location?.trim() ?? '',
    description: data.description?.trim() ?? '',
    salary: data.salary,
    jobType: data.jobType,
    experienceLevel: data.experienceLevel,
    postedDate: data.postedDate,
    sourceUrl: data.sourceUrl,
    sourceSite: data.sourceSite,
    confidence: data.confidence,
    extractedBy: 'ai-fallback',
  };
}

function normalizeMissingSkills(raw: unknown): CvScoreResult['missingSkills'] {
  if (!Array.isArray(raw)) return [];
  const items: NonNullable<CvScoreResult['missingSkills']> = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const skill = entry.trim();
      if (skill) items.push({ skill });
      continue;
    }
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const skill =
      (typeof o.skill === 'string' && o.skill.trim()) ||
      (typeof o.name === 'string' && o.name.trim()) ||
      '';
    if (!skill) continue;
    const tierRaw = o.tier;
    const tier =
      tierRaw === 'required' || tierRaw === 'preferred' || tierRaw === 'mentioned'
        ? tierRaw
        : undefined;
    const kindRaw = o.requirementKind ?? o.requirement_kind ?? o.kind;
    const requirementKind =
      kindRaw === 'tool' || kindRaw === 'phrase' ? kindRaw : undefined;
    items.push({
      skill,
      importance: typeof o.importance === 'string' ? o.importance : undefined,
      ...(tier ? { tier } : {}),
      ...(requirementKind ? { requirementKind } : {}),
    });
  }
  return items;
}

function warnExtensionScoreSource(scoreSource: string | undefined): void {
  const source = scoreSource?.trim().toLowerCase();
  if (source && source !== 'formula') {
    console.warn(
      `[extension/cv/score] Unexpected scoreSource "${scoreSource}" — expected "formula". Score may be stale; re-analyze this job.`,
    );
  }
}

function parseStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function parseExtensionTailorStatus(raw: unknown): CheckResponse['tailorStatus'] {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase();
  if (s === 'in_progress' || s === 'in-progress') return 'in_progress';
  if (s === 'completed' || s === 'complete') return 'completed';
  if (s === 'none') return 'none';
  return null;
}

function parseTailorFields(raw: Record<string, unknown>): Pick<
  CheckResponse,
  | 'isTailored'
  | 'selectedCvProfileId'
  | 'sourceCvProfileId'
  | 'matchCvProfileId'
  | 'tailorStatusLabel'
  | 'tailorSummary'
  | 'scoreBeforeTailoring'
  | 'tailorStatus'
  | 'tailorDraftId'
> {
  const isTailoredRaw = raw.isTailored === true || raw.is_tailored === true;
  const tailorStatus =
    parseExtensionTailorStatus(raw.tailorStatus ?? raw.tailor_status) ??
    (isTailoredRaw ? 'completed' : null);
  const isTailored = isTailoredRaw && tailorStatus === 'completed';
  const tailorDraftId =
    (typeof raw.tailorDraftId === 'string' && raw.tailorDraftId.trim()) ||
    (typeof raw.tailor_draft_id === 'string' && raw.tailor_draft_id.trim()) ||
    null;
  const selectedCvProfileId =
    (typeof raw.selectedCvProfileId === 'string' && raw.selectedCvProfileId.trim()) ||
    (typeof raw.selected_cv_profile_id === 'string' && raw.selected_cv_profile_id.trim()) ||
    null;
  const sourceCvProfileId =
    (typeof raw.sourceCvProfileId === 'string' && raw.sourceCvProfileId.trim()) ||
    (typeof raw.source_cv_profile_id === 'string' && raw.source_cv_profile_id.trim()) ||
    null;
  const matchCvProfileId =
    (typeof raw.matchCvProfileId === 'string' && raw.matchCvProfileId.trim()) ||
    (typeof raw.match_cv_profile_id === 'string' && raw.match_cv_profile_id.trim()) ||
    null;
  let tailorStatusLabel =
    (typeof raw.tailorStatusLabel === 'string' && raw.tailorStatusLabel.trim()) ||
    (typeof raw.tailor_status_label === 'string' && raw.tailor_status_label.trim()) ||
    null;
  if (!tailorStatusLabel && tailorStatus === 'in_progress') {
    tailorStatusLabel = 'Tailoring in progress';
  }
  if (!tailorStatusLabel && isTailored) {
    tailorStatusLabel = 'Tailored for this role';
  }
  const tailorSummary =
    (typeof raw.tailorSummary === 'string' && raw.tailorSummary.trim()) ||
    (typeof raw.tailor_summary === 'string' && raw.tailor_summary.trim()) ||
    null;
  const scoreBeforeTailoring = pickNumericScore(
    raw.scoreBeforeTailoring ?? raw.score_before_tailoring,
  );
  return {
    ...(isTailored ? { isTailored: true } : {}),
    ...(selectedCvProfileId ? { selectedCvProfileId } : {}),
    ...(sourceCvProfileId ? { sourceCvProfileId } : {}),
    ...(matchCvProfileId ? { matchCvProfileId } : {}),
    ...(tailorStatusLabel ? { tailorStatusLabel } : {}),
    ...(tailorSummary ? { tailorSummary } : {}),
    ...(scoreBeforeTailoring != null ? { scoreBeforeTailoring } : {}),
    ...(tailorStatus ? { tailorStatus } : {}),
    ...(tailorDraftId ? { tailorDraftId } : {}),
  };
}

function parseAnalysisDetailHint(raw: Record<string, unknown>): string | null {
  const hint =
    (typeof raw.analysisDetailHint === 'string' && raw.analysisDetailHint.trim()) ||
    (typeof raw.analysis_detail_hint === 'string' && raw.analysis_detail_hint.trim()) ||
    '';
  return hint || null;
}

function parseScoreFormulaTooltip(raw: Record<string, unknown>): string | null {
  const tooltip =
    (typeof raw.scoreFormulaTooltip === 'string' && raw.scoreFormulaTooltip.trim()) ||
    (typeof raw.score_formula_tooltip === 'string' && raw.score_formula_tooltip.trim()) ||
    '';
  return tooltip || null;
}

function mapCheckResponse(data: CheckResponse & Record<string, unknown>): CheckResponse {
  const raw = data as Record<string, unknown>;
  const companyLogoUrl =
    (typeof data.companyLogoUrl === 'string' && data.companyLogoUrl.trim()) ||
    (typeof raw.company_logo_url === 'string' && raw.company_logo_url.trim()) ||
    null;
  const hasCoverLetter =
    typeof data.hasCoverLetter === 'boolean'
      ? data.hasCoverLetter
      : typeof raw.has_cover_letter === 'boolean'
        ? raw.has_cover_letter
        : undefined;
  return {
    ...data,
    ...(companyLogoUrl ? { companyLogoUrl } : {}),
    ...(hasCoverLetter !== undefined ? { hasCoverLetter } : {}),
    topStrengths: normalizeStrengthsList(
      data.topStrengths ?? raw.strengths ?? raw.top_strengths ?? raw.keyStrengths,
    ),
    topGaps: normalizeStrengthsList(
      data.topGaps ?? raw.gaps ?? raw.top_gaps ?? raw.skillGaps ?? raw.skill_gaps,
    ),
    missingSkills: normalizeMissingSkills(data.missingSkills ?? raw.missing_skills),
    recommendation:
      typeof data.recommendation === 'string'
        ? data.recommendation
        : typeof raw.summary === 'string'
          ? raw.summary
          : null,
    analysisDetailHint: parseAnalysisDetailHint(raw),
    ...parseTailorFields(raw),
  };
}

function normalizeStrengthsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (!entry || typeof entry !== 'object') return '';
      const o = entry as Record<string, unknown>;
      if (typeof o.text === 'string') return o.text.trim();
      if (typeof o.strength === 'string') return o.strength.trim();
      if (typeof o.skill === 'string') return o.skill.trim();
      if (typeof o.label === 'string') return o.label.trim();
      return '';
    })
    .filter(Boolean);
}

function normalizeSkillCoverage(raw: unknown): CvScoreResult['skillCoverage'] {
  if (!Array.isArray(raw)) return [];
  const items: NonNullable<CvScoreResult['skillCoverage']> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const skill =
      (typeof o.skill === 'string' && o.skill.trim()) ||
      (typeof o.name === 'string' && o.name.trim()) ||
      '';
    if (!skill) continue;
    const statusRaw =
      typeof o.status === 'string' ? o.status.trim().toLowerCase() : 'missing';
    const keywordOnly = o.keywordOnly === true || o.keyword_only === true;
    const tierRaw = typeof o.tier === 'string' ? o.tier.trim().toLowerCase() : '';
    const tier =
      tierRaw === 'required' || tierRaw === 'preferred' || tierRaw === 'mentioned'
        ? tierRaw
        : undefined;
    const orGroupIdRaw = o.orGroupId ?? o.or_group_id;
    const orGroupId =
      typeof orGroupIdRaw === 'string' && orGroupIdRaw.trim()
        ? orGroupIdRaw.trim()
        : undefined;
    items.push({
      skill,
      status: statusRaw === 'found' ? 'found' : 'missing',
      importance: typeof o.importance === 'string' ? o.importance : undefined,
      ...(tier ? { tier } : {}),
      ...(keywordOnly ? { keywordOnly: true } : {}),
      ...(orGroupId ? { orGroupId } : {}),
    });
  }
  return items;
}

function pickNumericScore(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.min(100, Math.round(raw)));
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, Math.round(parsed)));
  }
  return null;
}

function scoreLabelFromMatchScore(score: number): CvScoreResult['scoreLabel'] {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Weak';
}

function parseScoreFactors(raw: Record<string, unknown>): CvScoreResult['factors'] {
  const source =
    raw.factors && typeof raw.factors === 'object' && !Array.isArray(raw.factors)
      ? (raw.factors as Record<string, unknown>)
      : raw.breakdown && typeof raw.breakdown === 'object' && !Array.isArray(raw.breakdown)
        ? (raw.breakdown as Record<string, unknown>)
        : null;

  const pick = (keys: string[]): number => {
    if (!source) return 0;
    for (const key of keys) {
      const value = pickNumericScore(source[key]);
      if (value != null) return value;
    }
    return 0;
  };

  return {
    skills: pick(['skills', 'skill', 'skillsMatch', 'skills_match']),
    experience: pick(['experience', 'experienceMatch', 'experience_match']),
    keywords: pick(['keywords', 'keyword', 'keywordsMatch', 'keywords_match']),
    seniority: pick(['seniority', 'seniorityMatch', 'seniority_match']),
    industry: pick(['industry', 'industryMatch', 'industry_match']),
  };
}

function flattenScorePayload(data: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...data };
  for (const key of ['analysis', 'jobAnalysis', 'job_analysis', 'result', 'scoreResult']) {
    const nested = data[key];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue;
    Object.assign(merged, nested as Record<string, unknown>);
  }
  return merged;
}

function pickJobAnalysisId(raw: Record<string, unknown>): string | null {
  for (const key of ['jobAnalysisId', 'job_analysis_id', 'jobId', 'job_id', 'id', 'analysisId']) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function mapApiScoreResult(data: CvScoreResult & Record<string, unknown>): CvScoreResult {
  const raw = flattenScorePayload(data as Record<string, unknown>);
  const aiAssessment =
    raw.aiAssessment && typeof raw.aiAssessment === 'object' && !Array.isArray(raw.aiAssessment)
      ? (raw.aiAssessment as Record<string, unknown>)
      : raw.ai_assessment && typeof raw.ai_assessment === 'object' && !Array.isArray(raw.ai_assessment)
        ? (raw.ai_assessment as Record<string, unknown>)
        : null;

  const skillCoverage = normalizeSkillCoverage(raw.skillCoverage ?? raw.skill_coverage);
  const missingSkills = normalizeMissingSkills(
    raw.missingSkills ?? raw.missing_skills ?? raw.gaps ?? raw.skillGaps ?? raw.skill_gaps,
  );

  const parsedStrengths = normalizeStrengthsList(
    raw.topStrengths ??
      raw.top_strengths ??
      raw.strengths ??
      raw.keyStrengths ??
      raw.key_strengths ??
      raw.positiveSignals ??
      aiAssessment?.strengths,
  );
  const parsedGaps = normalizeStrengthsList(
    raw.topGaps ??
      raw.top_gaps ??
      raw.gaps ??
      raw.skillGaps ??
      raw.skill_gaps ??
      aiAssessment?.improvements,
  );

  const topStrengths = parsedStrengths;

  const gapFromMissingSkills = (missingSkills ?? [])
    .map((item) => item.skill.trim())
    .filter(Boolean);
  const topGaps =
    gapFromMissingSkills.length > 0
      ? gapFromMissingSkills
      : parsedGaps;

  const matchScore = pickNumericScore(raw.matchScore ?? raw.match_score) ?? 0;

  const scoreLabelRaw = raw.scoreLabel ?? raw.score_label;
  const scoreLabel =
    typeof scoreLabelRaw === 'string' && scoreLabelRaw.trim()
      ? scoreLabelRaw.trim()
      : scoreLabelFromMatchScore(matchScore);

  const factorsBreakdown = parseFactorsBreakdown(
    raw.factorsBreakdown ?? raw.factors_breakdown,
  );

  const recommendationRaw = raw.recommendation ?? raw.summary ?? aiAssessment?.summary;
  const recommendation =
    typeof recommendationRaw === 'string'
      ? recommendationRaw.trim()
      : recommendationRaw &&
          typeof recommendationRaw === 'object' &&
          typeof (recommendationRaw as { text?: string }).text === 'string'
        ? (recommendationRaw as { text: string }).text.trim()
        : '';

  const companyLogoUrl =
    (typeof raw.companyLogoUrl === 'string' && raw.companyLogoUrl.trim()) ||
    (typeof raw.company_logo_url === 'string' && raw.company_logo_url.trim()) ||
    null;

  const parseOptionalScore = (v: unknown): number | null => {
    const n = pickNumericScore(v);
    return n;
  };

  const isTailoredRaw = raw.isTailored === true || raw.is_tailored === true;
  const tailorStatusParsed =
    parseExtensionTailorStatus(raw.tailorStatus ?? raw.tailor_status) ??
    (isTailoredRaw ? 'completed' : undefined);
  const isTailored = isTailoredRaw && tailorStatusParsed === 'completed';
  const scoreBeforeTailoring = parseOptionalScore(
    raw.scoreBeforeTailoring ?? raw.score_before_tailoring,
  );
  const selectedCvProfileId =
    (typeof raw.selectedCvProfileId === 'string' && raw.selectedCvProfileId.trim()) ||
    (typeof raw.selected_cv_profile_id === 'string' && raw.selected_cv_profile_id.trim()) ||
    null;
  const sourceCvProfileId =
    (typeof raw.sourceCvProfileId === 'string' && raw.sourceCvProfileId.trim()) ||
    (typeof raw.source_cv_profile_id === 'string' && raw.source_cv_profile_id.trim()) ||
    null;
  const tailorStatusLabel =
    (typeof raw.tailorStatusLabel === 'string' && raw.tailorStatusLabel.trim()) ||
    (typeof raw.tailor_status_label === 'string' && raw.tailor_status_label.trim()) ||
    null;
  const tailorSummary =
    (typeof raw.tailorSummary === 'string' && raw.tailorSummary.trim()) ||
    (typeof raw.tailor_summary === 'string' && raw.tailor_summary.trim()) ||
    null;
  const scoredAgainstCvProfileId =
    (typeof raw.scoredAgainstCvProfileId === 'string' && raw.scoredAgainstCvProfileId.trim()) ||
    (typeof raw.scored_against_cv_profile_id === 'string' &&
      raw.scored_against_cv_profile_id.trim()) ||
    null;
  const matchCvProfileId =
    (typeof raw.matchCvProfileId === 'string' && raw.matchCvProfileId.trim()) ||
    (typeof raw.match_cv_profile_id === 'string' && raw.match_cv_profile_id.trim()) ||
    scoredAgainstCvProfileId;
  const tailoredCvProfileId =
    (typeof raw.tailoredCvProfileId === 'string' && raw.tailoredCvProfileId.trim()) ||
    (typeof raw.tailored_cv_profile_id === 'string' && raw.tailored_cv_profile_id.trim()) ||
    null;
  const tailoredCvName =
    (typeof raw.tailoredCvName === 'string' && raw.tailoredCvName.trim()) ||
    (typeof raw.tailored_cv_name === 'string' && raw.tailored_cv_name.trim()) ||
    null;

  const scoreSource =
    (typeof raw.scoreSource === 'string' && raw.scoreSource) ||
    (typeof raw.score_source === 'string' && raw.score_source) ||
    undefined;
  warnExtensionScoreSource(scoreSource);

  return {
    matchScore,
    scoreLabel,
    factors: parseScoreFactors(raw),
    factorsBreakdown,
    strengths: parsedStrengths,
    topStrengths,
    topGaps,
    missingSkills,
    skillCoverage,
    skillsToHighlight: parseStringList(raw.skillsToHighlight ?? raw.skills_to_highlight),
    recommendation,
    jobAnalysisId: pickJobAnalysisId(raw),
    dashboardUrl:
      (typeof raw.dashboardUrl === 'string' && raw.dashboardUrl) ||
      (typeof raw.dashboard_url === 'string' && raw.dashboard_url) ||
      null,
    persisted:
      raw.persisted === true ||
      raw.saved === true ||
      raw.hasAnalysis === true ||
      raw.has_analysis === true,
    fromCache: raw.fromCache === true || raw.from_cache === true || raw.aiCached === true,
    aiUsage: (raw.aiUsage ?? raw.ai_usage) as AiUsageSnapshot | undefined,
    scoreSource,
    salaryEstimate: (raw.salaryEstimate ?? raw.salary_estimate ?? null) as CvScoreResult['salaryEstimate'],
    locationEligibility: (raw.locationEligibility ??
      raw.location_eligibility ??
      null) as CvScoreResult['locationEligibility'],
    companyLogoUrl,
    isTailored: isTailored || undefined,
    scoreBeforeTailoring,
    selectedCvProfileId,
    sourceCvProfileId,
    tailorStatusLabel: tailorStatusLabel ?? undefined,
    tailorSummary: tailorSummary ?? undefined,
    tailorStatus: tailorStatusParsed,
    tailorDraftId:
      (typeof raw.tailorDraftId === 'string' && raw.tailorDraftId.trim()) ||
      (typeof raw.tailor_draft_id === 'string' && raw.tailor_draft_id.trim()) ||
      undefined,
    scoredAgainstCvProfileId,
    matchCvProfileId,
    tailoredCvProfileId:
      tailoredCvProfileId ?? selectedCvProfileId ?? undefined,
    tailoredCvName,
    analysisDetailHint: parseAnalysisDetailHint(raw),
    scoreFormulaTooltip: parseScoreFormulaTooltip(raw),
  };
}

function mapJobState(data: ExtensionJobState & Record<string, unknown>): ExtensionJobState {
  const raw = data as Record<string, unknown>;
  const checkLike = mapCheckResponse({
    saved: Boolean(raw.saved),
    jobId:
      (typeof raw.jobId === 'string' && raw.jobId.trim()) ||
      (typeof raw.job_id === 'string' && raw.job_id.trim()) ||
      null,
    status:
      (typeof raw.status === 'string' && raw.status.trim()) ||
      null,
    hasAnalysis: raw.hasAnalysis === true || raw.has_analysis === true,
    matchScore: pickNumericScore(raw.matchScore ?? raw.match_score),
    scoreLabel:
      (typeof raw.scoreLabel === 'string' && raw.scoreLabel) ||
      (typeof raw.score_label === 'string' && raw.score_label) ||
      null,
    hasCoverLetter:
      raw.hasCoverLetter === true || raw.has_cover_letter === true ? true : undefined,
    dashboardUrl:
      (typeof raw.dashboardUrl === 'string' && raw.dashboardUrl) ||
      (typeof raw.dashboard_url === 'string' && raw.dashboard_url) ||
      null,
    aiUsage: (raw.aiUsage ?? raw.ai_usage) as AiUsageSnapshot | undefined,
    topStrengths: normalizeStrengthsList(
      raw.topStrengths ?? raw.top_strengths ?? raw.strengths,
    ),
    topGaps: normalizeStrengthsList(raw.topGaps ?? raw.top_gaps ?? raw.gaps),
    missingSkills: normalizeMissingSkills(raw.missingSkills ?? raw.missing_skills),
    recommendation:
      typeof raw.recommendation === 'string'
        ? raw.recommendation
        : typeof raw.summary === 'string'
          ? raw.summary
          : null,
    factors: parseScoreFactors(raw),
    analysisDetailHint: parseAnalysisDetailHint(raw),
    ...parseTailorFields(raw),
  });

  const coverLetterPreview =
    (typeof raw.coverLetterPreview === 'string' && raw.coverLetterPreview.trim()) ||
    (typeof raw.cover_letter_preview === 'string' && raw.cover_letter_preview.trim()) ||
    undefined;
  const coverLetterFull =
    (typeof raw.coverLetter === 'string' && raw.coverLetter.trim()) ||
    (typeof raw.cover_letter === 'string' && raw.cover_letter.trim()) ||
    undefined;

  return {
    saved: checkLike.saved,
    hasAnalysis: checkLike.hasAnalysis === true,
    matchScore: checkLike.matchScore,
    scoreLabel: checkLike.scoreLabel,
    hasCoverLetter: checkLike.hasCoverLetter,
    isTailored: checkLike.isTailored,
    selectedCvProfileId: checkLike.selectedCvProfileId,
    sourceCvProfileId: checkLike.sourceCvProfileId,
    matchCvProfileId: checkLike.matchCvProfileId,
    tailorStatusLabel: checkLike.tailorStatusLabel,
    tailorSummary: checkLike.tailorSummary,
    scoreBeforeTailoring: checkLike.scoreBeforeTailoring,
    tailorStatus: checkLike.tailorStatus,
    tailorDraftId: checkLike.tailorDraftId,
    jobTitle:
      (typeof raw.jobTitle === 'string' && raw.jobTitle.trim()) ||
      (typeof raw.job_title === 'string' && raw.job_title.trim()) ||
      null,
    company:
      (typeof raw.company === 'string' && raw.company.trim()) || null,
    topGaps: checkLike.topGaps,
    topStrengths: checkLike.topStrengths,
    recommendation: checkLike.recommendation,
    coverLetterPreview,
    coverLetter: coverLetterFull,
    persisted: raw.persisted === true || checkLike.hasAnalysis === true,
    dashboardUrl: checkLike.dashboardUrl,
    aiUsage: checkLike.aiUsage,
    jobId: checkLike.jobId,
    status: checkLike.status,
    missingSkills: checkLike.missingSkills,
    factors: checkLike.factors,
    analysisDetailHint: checkLike.analysisDetailHint ?? parseAnalysisDetailHint(raw),
  };
}

export const extractionApi = {
  extractJob: async (payload: {
    rawText: string;
    pageTitle: string;
    pageUrl: string;
  }): Promise<ExtractJobResult> => {
    const data = await apiFetch<ExtractJobApiResponse>('/extension/extract-job', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      job: mapApiExtractedJob(data),
      fromCache: Boolean(data.fromCache),
      aiUsage: data.aiUsage,
    };
  },
};

export type ExtensionAuthPayload = {
  extensionToken: string;
  expiresAt: string;
  user?: User;
};

export const authApi = {
  getMe: () => apiFetch<User>('/auth/extension/me'),

  /** Mint extension JWT from a web access token (no extension token side effects on 401). */
  mintExtensionToken: async (accessToken: string): Promise<ExtensionAuthPayload> => {
    const res = await fetch(resolveRequestUrl('/auth/extension-token'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return parseApiEnvelope<ExtensionAuthPayload>(res);
  },

  /** Preferred: sync from HttpOnly refresh cookie on the API origin. */
  syncFromBrowserSession: async (): Promise<ExtensionAuthPayload> => {
    const res = await fetch(resolveRequestUrl('/auth/extension/sync'), {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    return parseApiEnvelope<ExtensionAuthPayload>(res);
  },
};

export const jobsApi = {
  save: (payload: SaveJobPayload) =>
    apiFetch<{ id: string; status: string; companyLogoUrl?: string | null }>(
      '/extension/jobs/save',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  check: (url: string, cvId?: string | null) => {
    let path = `/extension/jobs/check?url=${encodeURIComponent(url)}`;
    const id = cvId?.trim();
    if (id) path += `&cvId=${encodeURIComponent(id)}`;
    return apiFetch<CheckResponse>(path).then(mapCheckResponse);
  },

  getJobAnalysis: (jobId: string, cvId?: string | null) => {
    const id = jobId.trim();
    let path = `/extension/jobs/${encodeURIComponent(id)}/analysis`;
    const cv = cvId?.trim();
    if (cv) path += `?cvId=${encodeURIComponent(cv)}`;
    return apiFetch<CvScoreResult>(path).then(mapApiScoreResult);
  },

  getState: (url: string) =>
    apiFetch<ExtensionJobState>(
      `/extension/jobs/state?url=${encodeURIComponent(url)}`,
    ).then(mapJobState),

  getGeneratedCoverLetter: (jobAnalysisId: string) =>
    apiFetch<{ coverLetter?: string | null; jobId?: string }>(
      `/jobs/generated/${encodeURIComponent(jobAnalysisId.trim())}`,
    ).then((body) => {
      const raw = body as Record<string, unknown>;
      const nested =
        raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
          ? (raw.data as Record<string, unknown>)
          : raw;
      const coverLetter =
        (typeof nested.coverLetter === 'string' && nested.coverLetter.trim()) ||
        (typeof nested.cover_letter === 'string' && nested.cover_letter.trim()) ||
        undefined;
      return { coverLetter, jobId: typeof nested.jobId === 'string' ? nested.jobId : jobAnalysisId };
    }),

  recent: (limit = 10) =>
    apiFetch<SavedJob[]>(`/extension/jobs/recent?limit=${limit}`),
};

export const cvApi = {
  getProfiles: () => apiFetch<CvProfile[]>('/extension/cv/profiles'),

  getAiUsage: () => apiFetch<AiUsageSnapshot>('/extension/ai-usage'),

  getScore: (payload: CvScoreRequestPayload) =>
    apiFetch<CvScoreResult>('/extension/cv/score', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then(mapApiScoreResult),

  generateCoverLetter: (payload: CoverLetterRequestPayload) =>
    apiFetch<CoverLetterResult>('/extension/cover-letter', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

export const tailorApi = {
  initiate: (payload: InitiateTailorPayload) =>
    apiFetch<TailorSession>('/extension/tailor/initiate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getSession: (sessionId: string) =>
    apiFetch<Record<string, unknown>>(`/extension/tailor/session/${sessionId}`),

  complete: (sessionId: string, tailoredCvId: string) =>
    apiFetch<{ success: boolean; returnToUrl: string; tailoredCvId: string }>(
      '/extension/tailor/complete',
      {
        method: 'POST',
        body: JSON.stringify({ sessionId, tailoredCvId }),
      },
    ),

  getStatus: (sessionId: string) =>
    apiFetch<{ completed: boolean; tailoredCvId: string | null }>(
      `/extension/tailor/status/${sessionId}`,
    ),
};
