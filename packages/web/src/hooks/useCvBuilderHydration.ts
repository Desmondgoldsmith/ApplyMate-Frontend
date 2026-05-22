'use client';

import { useCallback, useMemo } from 'react';

import { useCvStateRefresh } from '@/hooks/useCvStateRefresh';

export type CvBuilderHydrationOptions = {
  /** CV profile id (canonical `cvProfileId`). */
  profileId: string | null | undefined;
  /** Bump to force CVBuilder to re-hydrate structured state from React Query cache. */
  bumpHydrateNonce: () => void;
  /** Optional: clear optimistic / instant preview before refetch (e.g. assistant patch). */
  clearInstantPreview?: () => void;
};

/**
 * Full server re-sync for the CV builder: refetch profile + sections, then bump hydration nonce.
 * Use after mutations that change structured CV on the server.
 */
export function useCvBuilderHydration(options: CvBuilderHydrationOptions) {
  const { refreshCvState } = useCvStateRefresh();
  const { profileId, bumpHydrateNonce, clearInstantPreview } = options;

  const rehydrateFromServer = useCallback(async () => {
    clearInstantPreview?.();
    await refreshCvState(profileId, { refreshProfile: true, refreshSections: true });
    bumpHydrateNonce();
  }, [bumpHydrateNonce, clearInstantPreview, profileId, refreshCvState]);

  return useMemo(
    () => ({ rehydrateFromServer, refreshCvState }),
    [rehydrateFromServer, refreshCvState],
  );
}
