import type { QueryState } from '@tanstack/react-query';

/** How long a failed query is left alone when new observers mount. */
export const FAILED_QUERY_REMOUNT_COOLDOWN_MS = 10_000;

/**
 * `refetchOnMount` that skips queries which failed moments ago. A refetch without data puts the query
 * back to `pending`, so screens that swap skeleton ↔ sections on `isPending` remount their observers on
 * every failure, and plain `true` turns that into an endless request loop (e.g. 401 after sign-out).
 */
export function refetchOnMountUnlessJustFailed(query: {
  state: Pick<QueryState, 'status' | 'errorUpdatedAt'>;
}): boolean {
  const { status, errorUpdatedAt } = query.state;
  return (
    status !== 'error' ||
    Date.now() - errorUpdatedAt >= FAILED_QUERY_REMOUNT_COOLDOWN_MS
  );
}
