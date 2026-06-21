import { queryKeys } from '@/lib/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

import { logCvDevPerfWallMs } from '@/lib/cvDevPerf';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

export type CvSuggestionMutationReconcileKind = 'structuralAccept' | 'queueOnly';

export type CvSuggestionMutationReconcileOptions = {
  scoringTriggered?: boolean;
  /** When true, skip suggestions list invalidation (local cache already patched). */
  skipSuggestionsInvalidation?: boolean;
};

/**
 * Scoped invalidation after suggestion mutations — one score key + this profile’s suggestions only
 * (no unscoped `['cv','suggestions']` sweeps). Caller usually already patched the suggestions cache.
 */
export function reconcileAfterCvSuggestionMutation(
  queryClient: QueryClient,
  profileId: string | null | undefined,
  kind: CvSuggestionMutationReconcileKind,
  options?: CvSuggestionMutationReconcileOptions,
): number {
  const id = profileId?.trim();
  if (!id) return 0;
  let n = 0;
  void queryClient.invalidateQueries({ queryKey: queryKeys.cv.score(id), exact: true });
  n += 1;
  if (!options?.skipSuggestionsInvalidation) {
    const invalidateSuggestions = () => {
      void queryClient.invalidateQueries({
        queryKey: cvSuggestionsQueryKey(id),
        exact: true,
      });
    };
    if (options?.scoringTriggered) {
      window.setTimeout(invalidateSuggestions, 3000);
    } else {
      invalidateSuggestions();
    }
    n += 1;
  }
  if (kind === 'structuralAccept') {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles(), exact: true });
    n += 1;
  }
  return n;
}

export function logCvSuggestionMutationClientPerf(
  label: string,
  startedAt: number,
  detail?: { invalidations?: number; cacheWrites?: number },
): void {
  if (process.env.NODE_ENV !== 'development') return;
  // eslint-disable-next-line no-console -- intentional dev diagnostics
  console.info('[cv:suggestion-mutation]', { label, clientMs: Date.now() - startedAt, ...detail });
  logCvDevPerfWallMs(`cv.suggestionMutation.${label}`, startedAt, detail);
}
