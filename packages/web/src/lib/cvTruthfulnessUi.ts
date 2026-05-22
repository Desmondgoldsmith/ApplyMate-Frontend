import type { CvTruthfulnessMeta } from '@/lib/api';

const MAX_WARNINGS_SHOWN = 8;
const MAX_WARNING_CHARS = 220;

/** Normalize truthfulness fields from any apply/accept response for diff preview state. */
export function truthfulnessFieldsFromResponse(r: CvTruthfulnessMeta): CvTruthfulnessMeta {
  return {
    factualityValidated: r.factualityValidated,
    unsupportedChangesDetected: r.unsupportedChangesDetected,
    truthfulnessWarnings: r.truthfulnessWarnings,
  };
}

export function truncateTruthfulnessWarning(s: string, maxLen = MAX_WARNING_CHARS): string {
  const t = s.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

export function visibleTruthfulnessWarnings(warnings: string[] | undefined): string[] {
  if (!warnings?.length) return [];
  return warnings
    .map((w) => truncateTruthfulnessWarning(typeof w === 'string' ? w : String(w)))
    .filter(Boolean)
    .slice(0, MAX_WARNINGS_SHOWN);
}

export function shouldShowTruthfulnessAdjustNotice(meta: CvTruthfulnessMeta): boolean {
  if (meta.factualityValidated === false) return true;
  if (typeof meta.unsupportedChangesDetected === 'number' && meta.unsupportedChangesDetected > 0) return true;
  return (meta.truthfulnessWarnings?.length ?? 0) > 0;
}
