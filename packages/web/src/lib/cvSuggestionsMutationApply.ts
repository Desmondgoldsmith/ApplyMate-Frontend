import type { CvImprovementsPayload, CvSuggestionsBulkMutationResult, CvSuggestionMutationResult } from '@/lib/api';

function normalizeIdSet(ids: string[] | undefined): Set<string> | null {
  if (!ids?.length) return null;
  const s = new Set(ids.map((x) => x.trim()).filter(Boolean));
  return s.size > 0 ? s : null;
}

function mergeRevisionFromCommit(
  prev: CvImprovementsPayload,
  patch: { cvRevisionId?: string | null; structuredRevisionHash?: string | null },
): Pick<CvImprovementsPayload, 'cvRevisionId' | 'structuredRevisionHash'> {
  return {
    cvRevisionId: patch.cvRevisionId !== undefined ? patch.cvRevisionId : prev.cvRevisionId,
    structuredRevisionHash:
      patch.structuredRevisionHash !== undefined ? patch.structuredRevisionHash : prev.structuredRevisionHash,
  };
}

/** Merge single-suggestion accept response into the pending suggestions cache. */
export function applySuggestionAcceptToImprovementsCache(
  prev: CvImprovementsPayload | undefined,
  acceptedId: string,
  product: CvSuggestionMutationResult,
): CvImprovementsPayload | undefined {
  if (!prev?.improvements) return prev;
  const rid = acceptedId.trim();
  const serverIds = normalizeIdSet(product.acceptedSuggestionIds);
  /**
   * Prefer the explicit accepted pointer/id so unrelated rows stay when the server echoes a broad
   * `acceptedSuggestionIds` set. If the pointer is empty, fall back to the server id list only.
   */
  const remove = rid.length > 0 ? new Set([rid]) : serverIds ?? new Set<string>();
  const nextList =
    remove.size > 0
      ? prev.improvements.filter((it) => !remove.has((it?.id ?? '').trim()))
      : prev.improvements;
  return {
    ...prev,
    improvements: nextList,
    pendingSuggestionsCount: product.pendingSuggestionsCount ?? Math.max(0, nextList.length),
    ...mergeRevisionFromCommit(prev, {
      cvRevisionId: product.cvRevisionId ?? undefined,
      structuredRevisionHash: product.structuredRevisionHash,
    }),
  };
}

/** Merge single-suggestion reject into the pending suggestions cache. */
export function applySuggestionRejectToImprovementsCache(
  prev: CvImprovementsPayload | undefined,
  rejectedPointer: string,
  product: CvSuggestionMutationResult,
): CvImprovementsPayload | undefined {
  if (!prev?.improvements) return prev;
  const rid = rejectedPointer.trim();
  const serverIds = normalizeIdSet(product.rejectedSuggestionIds);
  const remove = serverIds ?? new Set([rid]);
  const nextList = prev.improvements.filter((it) => !remove.has((it?.id ?? '').trim()));
  return {
    ...prev,
    improvements: nextList,
    pendingSuggestionsCount: product.pendingSuggestionsCount ?? Math.max(0, nextList.length),
    ...mergeRevisionFromCommit(prev, {
      cvRevisionId: product.cvRevisionId ?? undefined,
      structuredRevisionHash: product.structuredRevisionHash,
    }),
  };
}

/** Merge accept-all response into the pending suggestions cache (ids preferred; counts as fallback). */
export function applyBulkAcceptToImprovementsCache(
  prev: CvImprovementsPayload | undefined,
  r: CvSuggestionsBulkMutationResult,
): CvImprovementsPayload | undefined {
  if (!prev?.improvements) return prev;
  const remove = normalizeIdSet(r.acceptedSuggestionIds);
  if (remove) {
    const nextList = prev.improvements.filter((it) => !remove.has((it?.id ?? '').trim()));
    return {
      ...prev,
      improvements: nextList,
      pendingSuggestionsCount: r.pendingSuggestionsCount ?? Math.max(0, nextList.length),
      ...mergeRevisionFromCommit(prev, {
        cvRevisionId: r.cvRevisionId,
        structuredRevisionHash: r.structuredRevisionHash,
      }),
    };
  }
  if (typeof r.remainingPendingCount === 'number' && r.remainingPendingCount === 0) {
    return {
      ...prev,
      improvements: [],
      pendingSuggestionsCount: r.pendingSuggestionsCount ?? 0,
      ...mergeRevisionFromCommit(prev, {
        cvRevisionId: r.cvRevisionId,
        structuredRevisionHash: r.structuredRevisionHash,
      }),
    };
  }
  if (
    typeof r.pendingSuggestionsCount === 'number' &&
    r.pendingSuggestionsCount === 0 &&
    prev.improvements.length > 0
  ) {
    return {
      ...prev,
      improvements: [],
      pendingSuggestionsCount: 0,
      ...mergeRevisionFromCommit(prev, {
        cvRevisionId: r.cvRevisionId,
        structuredRevisionHash: r.structuredRevisionHash,
      }),
    };
  }
  return prev;
}

/** Merge reject-all response into the pending suggestions cache. */
export function applyBulkRejectToImprovementsCache(
  prev: CvImprovementsPayload | undefined,
  r: CvSuggestionsBulkMutationResult,
): CvImprovementsPayload | undefined {
  if (!prev?.improvements) return prev;
  const remove = normalizeIdSet(r.rejectedSuggestionIds);
  if (remove) {
    const nextList = prev.improvements.filter((it) => !remove.has((it?.id ?? '').trim()));
    return {
      ...prev,
      improvements: nextList,
      pendingSuggestionsCount: r.pendingSuggestionsCount ?? Math.max(0, nextList.length),
      ...mergeRevisionFromCommit(prev, {
        cvRevisionId: r.cvRevisionId,
        structuredRevisionHash: r.structuredRevisionHash,
      }),
    };
  }
  if (typeof r.remainingPendingCount === 'number' && r.remainingPendingCount === 0) {
    return {
      ...prev,
      improvements: [],
      pendingSuggestionsCount: r.pendingSuggestionsCount ?? 0,
      ...mergeRevisionFromCommit(prev, {
        cvRevisionId: r.cvRevisionId,
        structuredRevisionHash: r.structuredRevisionHash,
      }),
    };
  }
  if (
    typeof r.pendingSuggestionsCount === 'number' &&
    r.pendingSuggestionsCount === 0 &&
    prev.improvements.length > 0
  ) {
    return {
      ...prev,
      improvements: [],
      pendingSuggestionsCount: 0,
      ...mergeRevisionFromCommit(prev, {
        cvRevisionId: r.cvRevisionId,
        structuredRevisionHash: r.structuredRevisionHash,
      }),
    };
  }
  return prev;
}
