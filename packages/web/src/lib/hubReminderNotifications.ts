import { queryKeys } from '@/lib/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

import type { HubReminderItem } from '@/lib/api';

const SESSION_FIRED_PREFIX = 'applymate:reminder-fired:';

/** Browser notifications for due pending hub reminders already in the React Query cache. */
export function notifyDueHubRemindersFromCache(queryClient: QueryClient): void {
  if (typeof window === 'undefined') return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const queries = queryClient.getQueriesData<HubReminderItem[]>({
    queryKey: queryKeys.hub.remindersRoot(),
  });
  const now = Date.now();
  const seen = new Set<string>();

  for (const [, data] of queries) {
    if (!Array.isArray(data)) continue;
    for (const r of data) {
      if (!r?.id || seen.has(r.id)) continue;
      if (r.status !== 'pending') continue;
      const t = new Date(r.remindAt).getTime();
      if (!Number.isFinite(t) || t > now) continue;
      if (now - t > 7 * 86_400_000) continue;
      seen.add(r.id);
      const flag = `${SESSION_FIRED_PREFIX}${r.id}`;
      try {
        if (sessionStorage.getItem(flag)) continue;
        const body =
          r.title?.trim() || r.note?.trim() || 'Scheduled follow-up';
        new Notification('ApplyMate reminder', { body });
        sessionStorage.setItem(flag, '1');
      } catch {
        /* ignore */
      }
    }
  }
}
