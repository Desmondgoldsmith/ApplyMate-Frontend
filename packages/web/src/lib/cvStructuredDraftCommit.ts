import type { QueryClient } from '@tanstack/react-query';

import { refreshCvState } from '@/lib/refreshCvState';

export type CommitAcceptedStructuredDraftOptions = {
  queryClient: QueryClient;
  profileId: string;
  /** Server write (assistant commit, generator accept, etc.). Omit only when the caller already persisted and only cache refresh is needed. */
  mutation?: () => Promise<unknown>;
  /**
   * Runs after profile + sections + suggestions refetch (e.g. increment {@link CVBuilder} `serverHydrateNonce`).
   * Diff preview should be cleared by the caller after this resolves, not inside the mutation.
   */
  onRehydrated?: () => void;
};

/**
 * Canonical post-commit pipeline: optional mutation, awaited scoped refetches, optional local
 * rehydrate hook, then a single scoped score invalidation (no delayed second-wave refetches).
 */
export async function commitAcceptedStructuredDraft(options: CommitAcceptedStructuredDraftOptions): Promise<void> {
  const { queryClient, profileId, mutation, onRehydrated } = options;
  const id = profileId.trim();
  if (!id) throw new Error('commitAcceptedStructuredDraft: missing profileId');

  if (mutation) {
    await mutation();
  }

  await refreshCvState(queryClient, id, {
    refreshProfile: true,
    refreshSections: true,
    refreshSuggestions: true,
    invalidateScore: true,
    invalidateCvProfilesList: false,
  });

  onRehydrated?.();
}

/** When persistence already ran (e.g. tailor section accept); only refetch + cache alignment. */
export function rehydrateCvBuilderAfterStructuredPersist(
  queryClient: QueryClient,
  profileId: string,
  onRehydrated?: () => void,
): Promise<void> {
  return commitAcceptedStructuredDraft({ queryClient, profileId, onRehydrated });
}
