import type { JobAnalysis } from '@/lib/api';

/** Skills found semantically but missing verbatim — for ATS risk callout. */
export function resolveAtsRiskItems(analysis: JobAnalysis): string[] {
  if (analysis.isTailored === true) return [];
  const topLevel = analysis.atsRiskItems ?? [];
  if (topLevel.length > 0) {
    return topLevel.map((s) => s.trim()).filter(Boolean);
  }
  const keywordFactor = analysis.factorsBreakdown?.factors.find(
    (f) => f.key === 'keywordCoverage',
  );
  return (keywordFactor?.semanticOnlyItems ?? []).map((s) => s.trim()).filter(Boolean);
}

export function stripAnalysisUserCopy(text: string): string {
  return text
    .replace(/\bJD\b/g, 'job description')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
