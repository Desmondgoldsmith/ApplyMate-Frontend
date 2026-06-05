import { queryKeys } from '@/lib/queryKeys';

/** React Query key for GET /cv/suggestions (pending queue only unless includeResolved). */
export function cvSuggestionsQueryKey(cvProfileId?: string | null) {
  return queryKeys.cv.suggestions(cvProfileId);
}

/** Invalidate every profile's suggestions cache (e.g. after uploads). */
export const CV_SUGGESTIONS_QUERY_ROOT = queryKeys.cv.suggestionsRoot();
