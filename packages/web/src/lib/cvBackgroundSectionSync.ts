import type { QueryClient } from '@tanstack/react-query';

import { refreshCvState } from '@/lib/refreshCvState';

/**
 * After accept when the server queued core section rebuild / async scoring, pull the latest
 * profile + sections once (deterministic — no fixed second-wave timer by default).
 */
export async function refetchCvProfileAndSectionsAfterBackgroundWork(
  queryClient: QueryClient,
  cvProfileId: string | undefined | null,
  opts?: { extraDelayMs?: number },
): Promise<void> {
  const id = cvProfileId?.trim();
  if (!id) return;
  const delay = opts?.extraDelayMs;
  if (delay != null && delay > 0) {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, delay);
    });
  }
  await refreshCvState(queryClient, id, {
    refreshProfile: true,
    refreshSections: true,
  });
}
