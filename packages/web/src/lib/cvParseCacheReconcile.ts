import { queryKeys } from '@/lib/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

import type { CVProfile } from '@/lib/api';
import { refreshCvState } from '@/lib/refreshCvState';

/**
 * After POST /cv/parse (or profile-scoped parse): align TanStack cache with canonical per-profile keys only.
 * Callers still invalidate `me` / `analytics` when needed.
 */
export async function refreshCvStateAfterCvParseSuccess(
  queryClient: QueryClient,
  profile: CVProfile,
): Promise<void> {
  const id = profile.id?.trim();
  if (!id) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles(), exact: true });
    return;
  }
  queryClient.setQueryData(queryKeys.cv.profile(id), profile);
  await refreshCvState(queryClient, id, {
    refreshProfile: true,
    refreshSections: true,
    refreshSuggestions: true,
    invalidateScore: true,
    invalidateCvProfilesList: true,
  });
}
