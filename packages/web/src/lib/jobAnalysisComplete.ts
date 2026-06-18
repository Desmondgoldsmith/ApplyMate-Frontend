import type { JobAnalysis } from '@/lib/api';

function isAiAnalyzeSource(source: string | null | undefined): boolean {
  const s = source?.trim().toLowerCase();
  return s === 'ai' || s === 'gemini';
}

/** True when the user has run AI job analysis (not bookmark-only / heuristic placeholders). */
export function isCompletedJobAnalysis(
  analysis: JobAnalysis | null | undefined,
): boolean {
  if (!analysis) return false;

  if (analysis.hasAnalysis === false) return false;
  if (analysis.hasAnalysis === true) return true;

  const scoreSource = analysis.scoreSource?.trim().toLowerCase();
  if (isAiAnalyzeSource(scoreSource)) return true;
  if (scoreSource === 'heuristic') return false;

  const analyzeSource = analysis.analyzeSource?.trim().toLowerCase();
  if (isAiAnalyzeSource(analyzeSource)) return true;
  if (analyzeSource === 'heuristic') return false;

  if (analysis.analysisV2) return true;

  const factors = analysis.factorsBreakdown;
  if (factors?.factors?.some((factor) => typeof factor.score === 'number')) {
    return true;
  }

  if ((analysis.missingSkills?.length ?? 0) > 0 && analysis.recommendation) {
    return true;
  }

  if (
    typeof analysis.matchScore === 'number' &&
    analysis.matchScore > 0 &&
    (analysis.breakdown || analysis.recommendation)
  ) {
    return true;
  }

  return false;
}

/** True when a history / hub row represents a completed AI analysis (not bookmark-only). */
export function historyItemHasCompletedAnalysis(item: {
  hasAnalysis?: boolean;
  analyzeSource?: string | null;
  analysisV2?: unknown;
  matchScore?: number | null;
  recommendation?: string | null;
}): boolean {
  if (item.hasAnalysis === false) return false;
  if (item.hasAnalysis === true) return true;

  if (isAiAnalyzeSource(item.analyzeSource)) return true;
  if (item.analyzeSource?.trim().toLowerCase() === 'heuristic') return false;

  if (item.analysisV2) return true;

  const score =
    typeof item.matchScore === 'number' && Number.isFinite(item.matchScore)
      ? item.matchScore
      : null;
  if (score != null && score > 0 && item.recommendation?.trim()) {
    return true;
  }

  return false;
}
