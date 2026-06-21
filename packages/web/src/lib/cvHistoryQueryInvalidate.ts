import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

const DEBOUNCE_MS = 500;
const timers = new Map<string, number>();

/**
 * Debounced score + suggestions invalidation after undo/redo restores editor content.
 * Local CV state updates instantly; network refetch waits until the user pauses.
 */
export function scheduleCvScoreAndSuggestionsInvalidate(
  queryClient: QueryClient,
  profileId: string | null | undefined,
): void {
  const id = profileId?.trim();
  if (!id) return;
  const existing = timers.get(id);
  if (existing != null) window.clearTimeout(existing);
  const handle = window.setTimeout(() => {
    timers.delete(id);
    void queryClient.invalidateQueries({
      queryKey: queryKeys.cv.score(id),
      exact: true,
    });
    void queryClient.invalidateQueries({
      queryKey: cvSuggestionsQueryKey(id),
      exact: true,
    });
  }, DEBOUNCE_MS);
  timers.set(id, handle);
}

export function cancelCvScoreAndSuggestionsInvalidate(
  profileId: string | null | undefined,
): void {
  const id = profileId?.trim();
  if (!id) return;
  const existing = timers.get(id);
  if (existing != null) {
    window.clearTimeout(existing);
    timers.delete(id);
  }
}
