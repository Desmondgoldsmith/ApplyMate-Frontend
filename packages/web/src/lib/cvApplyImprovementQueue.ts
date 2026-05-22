import type { CvApplyImprovementResult } from '@/lib/api';

/** Terminal no-diff apply: row closed server-side — drop from pending queue (not cache-only duplicate reuse). */
export function isCvApplyImprovementTerminalNoDiff(result: CvApplyImprovementResult): boolean {
  return result.alreadyApplied === true || result.autoResolved === true;
}

/** Success toast after queue row was closed as already satisfied (copy aligns with backend handoff). */
export function toastCopyForTerminalNoDiffApply(result: CvApplyImprovementResult): string {
  if (result.alreadyApplied === true && result.autoResolved === true) {
    return 'Applied — your CV already matched this suggestion.';
  }
  return 'This improvement is already reflected in your CV.';
}
