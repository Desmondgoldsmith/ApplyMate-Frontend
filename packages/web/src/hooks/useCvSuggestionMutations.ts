'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  type CvSuggestionMutationReconcileKind,
  reconcileAfterCvSuggestionMutation,
} from '@/lib/cvSuggestionMutationReconcile';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

/**
 * Single entry point for post–suggestion-mutation cache reconciliation.
 * Keeps suggestion queue, profile, sections, and score in sync without duplicating reconcile logic.
 */
export function useCvSuggestionMutations() {
  const queryClient = useQueryClient();

  const reconcileAfterMutation = useCallback(
    (
      profileId: string | null | undefined,
      kind: CvSuggestionMutationReconcileKind,
      options?: import('@/lib/cvSuggestionMutationReconcile').CvSuggestionMutationReconcileOptions,
    ) => reconcileAfterCvSuggestionMutation(queryClient, profileId, kind, options),
    [queryClient],
  );

  const suggestionsQueryKey = useCallback(
    (profileId: string | null | undefined) => cvSuggestionsQueryKey(profileId),
    [],
  );

  return useMemo(
    () => ({
      reconcileAfterMutation,
      suggestionsQueryKey,
    }),
    [reconcileAfterMutation, suggestionsQueryKey],
  );
}
