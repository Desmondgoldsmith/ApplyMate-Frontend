'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { type RefreshCvStateOptions, refreshCvState } from '@/lib/refreshCvState';

/**
 * Centralized scoped CV cache refresh (profile, sections, suggestions, score, list).
 * Prefer this over ad-hoc `refetchQueries` / broad `invalidateQueries` in CV Clinic flows.
 */
export function useCvStateRefresh() {
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      refreshCvState: (profileId: string | null | undefined, options: RefreshCvStateOptions) =>
        refreshCvState(queryClient, profileId, options),
    }),
    [queryClient],
  );
}

/** Stable callback form when you only need the async function. */
export function useCvStateRefreshFn() {
  const { refreshCvState } = useCvStateRefresh();
  return useCallback(
    (profileId: string | null | undefined, options: RefreshCvStateOptions) =>
      refreshCvState(profileId, options),
    [refreshCvState],
  );
}
