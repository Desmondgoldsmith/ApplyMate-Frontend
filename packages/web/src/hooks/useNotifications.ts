'use client';

import type { QueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';

import { api } from '@/lib/api';

/** List vs unread-count must not share a prefix — see invalidateNotificationList(). */
export const NOTIFICATION_LIST_KEY = ['notifications', 'list'] as const;
export const NOTIFICATION_UNREAD_COUNT_KEY = ['notifications', 'unread-count'] as const;

const UNREAD_STALE_MS = 5 * 60_000;
const UNREAD_INVALIDATE_DEBOUNCE_MS = 5_000;
const DEFAULT_RATE_LIMIT_PAUSE_MS = 60_000;

let unreadInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
let unreadFetchPausedUntil = 0;
const unreadPauseListeners = new Set<() => void>();

function subscribeUnreadPause(listener: () => void) {
  unreadPauseListeners.add(listener);
  return () => {
    unreadPauseListeners.delete(listener);
  };
}

function getUnreadPauseSnapshot() {
  return Date.now() >= unreadFetchPausedUntil;
}

function pauseUnreadFetch(ms: number) {
  const until = Date.now() + ms;
  if (until <= unreadFetchPausedUntil) return;
  unreadFetchPausedUntil = until;
  for (const listener of unreadPauseListeners) listener();
  window.setTimeout(() => {
    for (const listener of unreadPauseListeners) listener();
  }, ms + 100);
}

function rateLimitPauseMs(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  const nested = (error.response?.data as { error?: { retryAfterSeconds?: number } } | undefined)
    ?.error;
  const sec = nested?.retryAfterSeconds;
  if (typeof sec === 'number' && sec > 0) return sec * 1000;
  if (error.response?.status === 429) return DEFAULT_RATE_LIMIT_PAUSE_MS;
  return null;
}

/** Live session — badge polling is unnecessary and competes with interview APIs. */
export function isLiveInterviewSessionPath(pathname: string): boolean {
  const path = pathname.split('?')[0] ?? pathname;
  return /^\/dashboard\/interview\/[^/]+/.test(path) && !path.endsWith('/history');
}

/** Coalesce mutation-driven unread refetches. */
export function scheduleUnreadNotificationCountInvalidate(queryClient: QueryClient) {
  if (unreadInvalidateTimer != null) clearTimeout(unreadInvalidateTimer);
  unreadInvalidateTimer = setTimeout(() => {
    unreadInvalidateTimer = null;
    if (!getUnreadPauseSnapshot()) return;
    void queryClient.invalidateQueries({
      queryKey: NOTIFICATION_UNREAD_COUNT_KEY,
      exact: true,
      refetchType: 'active',
    });
  }, UNREAD_INVALIDATE_DEBOUNCE_MS);
}

/** Invalidate notification list only — never matches unread-count. */
export function invalidateNotificationList(queryClient: QueryClient) {
  void queryClient.invalidateQueries({
    queryKey: NOTIFICATION_LIST_KEY,
    exact: true,
    refetchType: 'active',
  });
}

export function useNotifications(enabled = true) {
  return useQuery({
    queryKey: NOTIFICATION_LIST_KEY,
    queryFn: () => api.notifications.list(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
    refetchInterval: false,
  });
}

export function useUnreadNotificationCount(options?: { enabled?: boolean }) {
  const pathname = usePathname();
  const pauseLifted = useSyncExternalStore(
    subscribeUnreadPause,
    getUnreadPauseSnapshot,
    () => true,
  );
  const onLiveInterview = isLiveInterviewSessionPath(pathname);
  const enabled = (options?.enabled ?? true) && !onLiveInterview && pauseLifted;

  return useQuery({
    queryKey: NOTIFICATION_UNREAD_COUNT_KEY,
    queryFn: async () => {
      try {
        return await api.notifications.getUnreadCount();
      } catch (error) {
        const pauseMs = rateLimitPauseMs(error);
        if (pauseMs) pauseUnreadFetch(pauseMs);
        throw error;
      }
    },
    enabled,
    staleTime: UNREAD_STALE_MS,
    gcTime: UNREAD_STALE_MS * 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    refetchInterval: false,
    retry: false,
  });
}
