import type { QueryClient } from '@tanstack/react-query';

import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';
import { refreshCvState } from '@/lib/refreshCvState';

const ACCEPT_ALL_POLL_MS = 3000;
const ACCEPT_ALL_POLL_MAX_ATTEMPTS = 30;

/** Re-fetch CV state after accept-all timeout / abort — never assume success. */
export async function refetchCvAfterAcceptAllUncertainty(
  queryClient: QueryClient,
  profileId: string | null | undefined,
): Promise<void> {
  const id = profileId?.trim();
  if (!id) return;
  await refreshCvState(queryClient, id, {
    refreshProfile: true,
    refreshSections: true,
    refreshSuggestions: true,
    invalidateScore: true,
  });
}

/** Poll suggestions while another accept-all is in flight on the server. */
export async function pollSuggestionsWhileAcceptAllInProgress(
  queryClient: QueryClient,
  profileId: string | null | undefined,
): Promise<void> {
  const id = profileId?.trim();
  if (!id) return;
  const qk = cvSuggestionsQueryKey(id);
  for (let attempt = 0; attempt < ACCEPT_ALL_POLL_MAX_ATTEMPTS; attempt += 1) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, ACCEPT_ALL_POLL_MS);
    });
    await queryClient.invalidateQueries({ queryKey: qk, exact: true });
  }
}
