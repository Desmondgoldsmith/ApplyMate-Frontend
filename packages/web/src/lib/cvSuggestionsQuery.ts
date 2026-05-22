/** React Query key for GET /cv/suggestions (pending queue only unless includeResolved). */
export function cvSuggestionsQueryKey(cvProfileId?: string | null) {
  return ['cv', 'suggestions', cvProfileId?.trim() || 'default'] as const;
}

/** Invalidate every profile's suggestions cache (e.g. after uploads). */
export const CV_SUGGESTIONS_QUERY_ROOT = ['cv', 'suggestions'] as const;
