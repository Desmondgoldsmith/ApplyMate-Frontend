import type {
  CheckResponse,
  CoverLetterResult,
  CvScoreResult,
  ExtensionJobSession,
  ExtensionJobState,
  ExtractedJob,
} from '@/shared/types';
import { factorByKey } from '@/shared/factors-breakdown';
import { canonicalJobViewUrl, normalizeJobPageUrl } from '@/shared/job-page-url';

export type { ExtensionJobSession };

export function sessionKeyForUrl(url: string): string {
  const normalized = normalizeJobPageUrl(url) ?? url.trim();
  try {
    const parsed = new URL(normalized);
    parsed.hash = '';
    return `jobSession:${parsed.href}`;
  } catch {
    return `jobSession:${normalized}`;
  }
}

export function savedJobStorageKey(url: string): string {
  return `savedJob:${url}`;
}

export function extractLockKey(url: string): string {
  return `extractLock:${sessionKeyForUrl(url)}`;
}

/** Remove all persisted session data for one job URL. */
export async function clearJobStorageForUrl(url: string): Promise<void> {
  if (!url.trim()) return;
  await chrome.storage.session.remove([
    sessionKeyForUrl(url),
    savedJobStorageKey(url),
    extractLockKey(url),
  ]);
}

const JOB_SESSION_KEY_PREFIXES = ['jobSession:', 'savedJob:', 'extractLock:'] as const;
const JOB_SESSION_ROOT_KEYS = [
  'currentJob',
  'pinnedJobUrl',
  'activeTailorSession',
] as const;

/** Wipe cached job/score/session blobs from extension storage. */
export async function clearAllExtensionJobStorage(): Promise<void> {
  const stored = await chrome.storage.session.get(null);
  const keys = Object.keys(stored ?? {}).filter(
    (key) =>
      JOB_SESSION_ROOT_KEYS.includes(key as (typeof JOB_SESSION_ROOT_KEYS)[number]) ||
      JOB_SESSION_KEY_PREFIXES.some((prefix) => key.startsWith(prefix)),
  );
  if (keys.length > 0) {
    await chrome.storage.session.remove(keys);
  }
}

export function emptyJobSession(pageUrl: string): ExtensionJobSession {
  return {
    pageUrl,
    jobAnalysisId: null,
    extractedJob: null,
    check: null,
    score: null,
    coverLetter: null,
    selectedCvId: null,
  };
}

export function coverLetterLocalStorageKey(sourceUrl: string): string {
  const canonical = canonicalJobViewUrl(sourceUrl) ?? sourceUrl.trim();
  return `coverLetter:${canonical}`;
}

export async function persistCoverLetterLocal(
  sourceUrl: string,
  result: CoverLetterResult,
): Promise<void> {
  if (!sourceUrl.trim()) return;
  await chrome.storage.local.set({
    [coverLetterLocalStorageKey(sourceUrl)]: result,
  });
}

async function readCoverLetterLocal(url: string): Promise<CoverLetterResult | null> {
  const key = coverLetterLocalStorageKey(url);
  const stored = await chrome.storage.local.get(key);
  const raw = stored[key];
  if (!raw || typeof raw !== 'object') return null;
  const letter = raw as CoverLetterResult;
  if (typeof letter.coverLetter !== 'string' || !letter.coverLetter.trim()) return null;
  return letter;
}

export async function readJobSession(url: string): Promise<ExtensionJobSession | null> {
  const key = sessionKeyForUrl(url);
  const stored = await chrome.storage.session.get(key);
  const raw = stored[key];
  let session: ExtensionJobSession | null = null;
  if (typeof raw === 'string') {
    try {
      session = JSON.parse(raw) as ExtensionJobSession;
    } catch {
      session = null;
    }
  }
  if (!session) return null;
  if (!session.coverLetter?.coverLetter?.trim()) {
    const fromLocal = await readCoverLetterLocal(url);
    if (fromLocal) {
      session = { ...session, coverLetter: fromLocal };
    }
  }
  return session;
}

export async function writeJobSession(session: ExtensionJobSession): Promise<void> {
  const key = sessionKeyForUrl(session.pageUrl);
  await chrome.storage.session.set({ [key]: JSON.stringify(session) });
}

export async function mergeJobSession(
  url: string,
  patch: Partial<ExtensionJobSession>,
): Promise<ExtensionJobSession> {
  const existing = (await readJobSession(url)) ?? emptyJobSession(url);
  const merged: ExtensionJobSession = {
    ...existing,
    ...patch,
    pageUrl: url,
    jobAnalysisId: patch.jobAnalysisId ?? patch.check?.jobId ?? existing.jobAnalysisId,
  };
  await writeJobSession(merged);
  return merged;
}

export function sessionHasMeaningfulWork(session: ExtensionJobSession | null): boolean {
  if (!session) return false;
  const hasScore =
    session.score != null &&
    Number.isFinite(session.score.matchScore);
  return (
    hasScore ||
    isRichScore(session.score) ||
    Boolean(session.check?.saved) ||
    Boolean(session.check?.hasAnalysis) ||
    Boolean(session.coverLetter)
  );
}

/** Any extracted or analyzed job the user is actively working on in the sidebar. */
export function pinnedSessionHasLoadedJob(
  session: ExtensionJobSession | null | undefined,
): boolean {
  if (!session) return false;
  return (
    Boolean(session.extractedJob?.title?.trim()) || sessionHasMeaningfulWork(session)
  );
}

export function isRichScore(score: CvScoreResult | null | undefined): boolean {
  return isAlignedExtensionScore(score);
}

export const MAX_GAP_LABELS = 40;

/** Score payload from POST /cv/score or GET /jobs/:id/analysis — safe to show in UI. */
export function isAlignedExtensionScore(
  score: CvScoreResult | null | undefined,
): boolean {
  if (!score || !Number.isFinite(score.matchScore)) return false;
  const source = score.scoreSource?.trim().toLowerCase();
  if (source === 'formula') return true;
  // Sync payloads with full breakdown (post-deploy); reject legacy AI headline cache.
  if (source === 'ai') return false;
  return (score.factorsBreakdown?.factors?.length ?? 0) > 0;
}

export function strengthsFromScore(score: CvScoreResult, limit = 6): string[] {
  const fromApi =
    (score.strengths?.length ? score.strengths : score.topStrengths) ?? [];
  return fromApi
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function strengthLabelsFromScore(score: CvScoreResult, limit = 6): string[] {
  return strengthsFromScore(score, limit);
}

export function gapLabelsFromScore(score: CvScoreResult, limit = MAX_GAP_LABELS): string[] {
  const skillsFactor = factorByKey(score.factorsBreakdown, 'skillsMatch');
  const keywordFactor = factorByKey(score.factorsBreakdown, 'keywordCoverage');
  const fromFactors = [
    ...(skillsFactor?.missing ?? []),
    ...(keywordFactor?.missing ?? []),
  ];
  if (fromFactors.length > 0) {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const raw of fromFactors) {
      const label = raw.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(label);
      if (labels.length >= limit) return labels;
    }
    return labels;
  }

  const seen = new Set<string>();
  const labels: string[] = [];
  const push = (raw: string | null | undefined) => {
    const label = raw?.trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    labels.push(label);
  };

  for (const item of score.missingSkills ?? []) {
    push(item.skill);
    if (labels.length >= limit) return labels.slice(0, limit);
  }
  for (const item of score.topGaps ?? []) {
    push(item);
    if (labels.length >= limit) return labels.slice(0, limit);
  }

  return labels;
}

/** Full gaps list — prefer server `missingSkills` (tools + phrases, up to 40). */
export function allGapLabelsFromScore(score: CvScoreResult): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const entry of score.missingSkills ?? []) {
    const label = entry.skill?.trim() ?? '';
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
    if (labels.length >= MAX_GAP_LABELS) return labels;
  }
  if (labels.length > 0) return labels;
  return gapLabelsFromScore(score, MAX_GAP_LABELS);
}

/** Reuse a persisted aligned score without burning another AI quota call. */
export function canReuseCachedScore(
  score: CvScoreResult | null | undefined,
  _check: CheckResponse | null | undefined,
): boolean {
  return isAlignedExtensionScore(score);
}

/** Keep only aligned score payloads — never promote /jobs/check stubs into UI state. */
export function pickBestScore(
  existing: CvScoreResult | null | undefined,
  _fromCheck: CvScoreResult | null | undefined,
): CvScoreResult | null {
  if (isAlignedExtensionScore(existing)) return existing ?? null;
  return null;
}

function normalizeScoreLabel(
  label: string | null | undefined,
  matchScore?: number | null,
): string {
  if (typeof label === 'string' && label.trim()) return label.trim();
  const score = typeof matchScore === 'number' && Number.isFinite(matchScore) ? matchScore : 0;
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Weak';
}

export function scoreFromCheck(check: CheckResponse): CvScoreResult | null {
  if (!check.hasAnalysis || check.matchScore == null) return null;

  const topStrengths = check.topStrengths ?? [];
  const topGaps = check.topGaps ?? [];
  const missingSkills = Array.isArray(check.missingSkills)
    ? check.missingSkills
        .map((entry) =>
          typeof entry === 'string'
            ? { skill: entry.trim() }
            : { skill: entry.skill?.trim() ?? '', importance: entry.importance },
        )
        .filter((entry) => entry.skill.length > 0)
    : [];

  const hasDetail =
    topStrengths.length > 0 ||
    topGaps.length > 0 ||
    missingSkills.length > 0 ||
    Boolean(check.recommendation?.trim());

  return {
    matchScore: check.matchScore,
    scoreLabel: normalizeScoreLabel(check.scoreLabel, check.matchScore),
    factors: check.factors ?? {
      skills: 0,
      experience: 0,
      keywords: 0,
      seniority: 0,
      industry: 0,
    },
    topStrengths,
    topGaps,
    missingSkills,
    recommendation: check.recommendation?.trim() ?? '',
    jobAnalysisId: check.jobId,
    dashboardUrl: check.dashboardUrl ?? null,
    analysisDetailHint: check.analysisDetailHint ?? null,
    persisted: hasDetail,
    fromCache: true,
    isTailored: check.isTailored,
    scoreBeforeTailoring: check.scoreBeforeTailoring ?? null,
    selectedCvProfileId: check.selectedCvProfileId ?? null,
    sourceCvProfileId: check.sourceCvProfileId ?? null,
    tailorStatusLabel: check.tailorStatusLabel ?? undefined,
    tailorSummary: check.tailorSummary ?? undefined,
    tailorStatus: check.tailorStatus ?? undefined,
    tailorDraftId: check.tailorDraftId ?? undefined,
    tailoredCvProfileId: check.selectedCvProfileId ?? undefined,
  };
}

export function applyServerStateToSession(
  url: string,
  session: ExtensionJobSession,
  state: ExtensionJobState,
  job?: ExtractedJob | null,
): ExtensionJobSession {
  const check: CheckResponse = {
    saved: state.saved,
    jobId: state.jobId ?? null,
    status: state.status ?? null,
    hasAnalysis: state.hasAnalysis,
    matchScore: state.matchScore ?? null,
    scoreLabel: state.scoreLabel ?? null,
    hasCoverLetter: state.hasCoverLetter,
    dashboardUrl: state.dashboardUrl ?? null,
    aiUsage: state.aiUsage,
    topStrengths: state.topStrengths,
    topGaps: state.topGaps,
    missingSkills: state.missingSkills,
    recommendation: state.recommendation ?? null,
    factors: state.factors,
    isTailored: state.isTailored,
    selectedCvProfileId: state.selectedCvProfileId ?? null,
    sourceCvProfileId: state.sourceCvProfileId ?? null,
    tailorStatusLabel: state.tailorStatusLabel ?? null,
    tailorSummary: state.tailorSummary ?? null,
    scoreBeforeTailoring: state.scoreBeforeTailoring ?? null,
    tailorStatus: state.tailorStatus ?? null,
    tailorDraftId: state.tailorDraftId ?? null,
    analysisDetailHint: state.analysisDetailHint ?? null,
  };

  const fromCheck = scoreFromCheck(check);
  const mergedScore: CvScoreResult | null = isAlignedExtensionScore(session.score)
    ? session.score
    : null;

  let coverLetter: CoverLetterResult | null = session.coverLetter;
  const coverLetterText =
    state.coverLetter?.trim() ||
    state.coverLetterPreview?.trim();
  if (coverLetterText && state.hasCoverLetter) {
    coverLetter = {
      coverLetter: coverLetterText,
      wordCount: coverLetterText.split(/\s+/).filter(Boolean).length,
      generatedAt: new Date().toISOString(),
      jobAnalysisId: state.jobId ?? session.jobAnalysisId,
      dashboardUrl: state.dashboardUrl ?? null,
      persisted: true,
    };
  }

  let extractedJob = session.extractedJob ?? job ?? null;
  if (extractedJob && (state.jobTitle?.trim() || state.company?.trim())) {
    extractedJob = {
      ...extractedJob,
      title: state.jobTitle?.trim() || extractedJob.title,
      company: state.company?.trim() || extractedJob.company,
    };
  }

  const selectedCvId =
    state.selectedCvProfileId?.trim() ||
    session.selectedCvId ||
    null;

  return {
    ...session,
    pageUrl: url,
    extractedJob,
    jobAnalysisId: state.jobId ?? session.jobAnalysisId,
    check,
    score: pickBestScore(mergedScore, fromCheck),
    coverLetter,
    selectedCvId,
  };
}

export function applyCheckToSession(
  url: string,
  session: ExtensionJobSession,
  check: CheckResponse,
): ExtensionJobSession {
  const fromCheck = scoreFromCheck(check);
  const selectedCvId =
    check.selectedCvProfileId?.trim() ||
    fromCheck?.selectedCvProfileId?.trim() ||
    session.selectedCvId;
  return {
    ...session,
    pageUrl: url,
    jobAnalysisId: check.jobId ?? session.jobAnalysisId,
    check,
    score: pickBestScore(session.score, fromCheck),
    coverLetter: session.coverLetter,
    selectedCvId: selectedCvId ?? null,
  };
}
