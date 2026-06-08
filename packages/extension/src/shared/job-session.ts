import type { AiUsageSnapshot, CheckResponse, CvScoreResult, ExtensionJobSession } from '@/shared/types';

export type { ExtensionJobSession };

export function sessionKeyForUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    return `jobSession:${parsed.href}`;
  } catch {
    return `jobSession:${url}`;
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

export async function readJobSession(url: string): Promise<ExtensionJobSession | null> {
  const key = sessionKeyForUrl(url);
  const stored = await chrome.storage.session.get(key);
  const raw = stored[key];
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as ExtensionJobSession;
  } catch {
    return null;
  }
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

export function isRichScore(score: CvScoreResult | null | undefined): boolean {
  if (!score) return false;
  return (
    score.topStrengths.length > 0 ||
    score.topGaps.length > 0 ||
    (score.missingSkills?.length ?? 0) > 0 ||
    (score.skillCoverage?.length ?? 0) > 0 ||
    Boolean(score.recommendation?.trim()) ||
    score.factors.skills > 0 ||
    score.factors.experience > 0
  );
}

export function gapLabelsFromScore(score: CvScoreResult, limit = 15): string[] {
  if (score.missingSkills?.length) {
    return score.missingSkills.map((item) => item.skill).filter(Boolean).slice(0, limit);
  }
  if (score.skillCoverage?.length) {
    return score.skillCoverage
      .filter((item) => item.status === 'missing')
      .map((item) => item.skill)
      .filter(Boolean)
      .slice(0, limit);
  }
  if (score.skillsToHighlight?.length) {
    return score.skillsToHighlight.filter(Boolean).slice(0, limit);
  }
  return score.topGaps.slice(0, limit);
}

/** Reuse a persisted or cached score without burning another AI quota call. */
export function canReuseCachedScore(
  score: CvScoreResult | null | undefined,
  check: CheckResponse | null | undefined,
): boolean {
  if (!score) return false;
  if (score.fromCache || score.persisted || isRichScore(score)) return true;
  return Boolean(check?.hasAnalysis && check.matchScore != null);
}

/** Prefer a full AI score over the minimal score returned by /jobs/check. */
export function pickBestScore(
  existing: CvScoreResult | null | undefined,
  fromCheck: CvScoreResult | null | undefined,
): CvScoreResult | null {
  if (isRichScore(existing)) {
    if (!fromCheck) return existing ?? null;
    return {
      ...existing!,
      matchScore: fromCheck.matchScore,
      scoreLabel: fromCheck.scoreLabel ?? existing!.scoreLabel,
      jobAnalysisId: fromCheck.jobAnalysisId ?? existing!.jobAnalysisId,
      dashboardUrl: fromCheck.dashboardUrl ?? existing!.dashboardUrl,
      persisted: existing!.persisted ?? fromCheck.persisted,
    };
  }
  return fromCheck ?? existing ?? null;
}

export function scoreFromCheck(check: CheckResponse): CvScoreResult | null {
  if (!check.hasAnalysis || check.matchScore == null) return null;
  const label = check.scoreLabel;
  const scoreLabel =
    label === 'Excellent' ||
    label === 'Strong' ||
    label === 'Good' ||
    label === 'Fair' ||
    label === 'Weak'
      ? label
      : 'Fair';
  return {
    matchScore: check.matchScore,
    scoreLabel,
    factors: { skills: 0, experience: 0, keywords: 0, seniority: 0, industry: 0 },
    topStrengths: [],
    topGaps: [],
    recommendation: '',
    jobAnalysisId: check.jobId,
    dashboardUrl: check.dashboardUrl ?? null,
    persisted: true,
  };
}

export function applyCheckToSession(
  url: string,
  session: ExtensionJobSession,
  check: CheckResponse,
): ExtensionJobSession {
  const fromCheck = scoreFromCheck(check);
  return {
    ...session,
    pageUrl: url,
    jobAnalysisId: check.jobId ?? session.jobAnalysisId,
    check,
    score: pickBestScore(session.score, fromCheck),
    coverLetter: session.coverLetter,
  };
}
