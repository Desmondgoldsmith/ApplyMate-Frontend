'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useMobileShell } from '@/components/dashboard/MobileShellContext';
import {
  invalidateNotificationList,
  NOTIFICATION_UNREAD_COUNT_KEY,
  useNotifications,
  useUnreadNotificationCount,
} from '@/hooks/useNotifications';
import { api, type NotificationItem } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import {
  notificationActionHref,
  notificationActionLabel,
} from '@/lib/notificationDeepLink';
import { cn } from '@/lib/utils';

function splitNotificationMessage(message: string): {
  title: string;
  detail: string;
} {
  const normalized = message.replace(/\s+/g, ' ').trim();
  if (!normalized) return { title: 'Notification', detail: '' };
  const sentenceBoundary = normalized.search(/[.!?](\s|$)/);
  if (sentenceBoundary > 12) {
    const first = normalized.slice(0, sentenceBoundary + 1).trim();
    const rest = normalized.slice(sentenceBoundary + 1).trim();
    return { title: first, detail: rest };
  }
  return { title: normalized, detail: '' };
}

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 45) return 'Just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 36) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 14) return `${day}d ago`;
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      -Math.round(day),
      'day',
    );
  } catch {
    return '';
  }
}

export function NotificationBell() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { navVisible, navBottomOffset } = useMobileShell();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const unread = useUnreadNotificationCount();
  const notifications = useNotifications(open);

  const markRead = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      invalidateNotificationList(queryClient);
      queryClient.setQueryData<number>(NOTIFICATION_UNREAD_COUNT_KEY, (prev) =>
        Math.max(0, (prev ?? 1) - 1),
      );
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      invalidateNotificationList(queryClient);
      queryClient.setQueryData(NOTIFICATION_UNREAD_COUNT_KEY, 0);
    },
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      if (window.matchMedia('(max-width: 767px)').matches) return;
      const panel = panelRef.current;
      if (panel) {
        const rect = panel.getBoundingClientRect();
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          return;
        }
      }
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const count = unread.data ?? 0;
  const badge = count > 9 ? '9+' : count > 0 ? String(count) : '';

  const onNotificationClick = useCallback(
    async (n: NotificationItem) => {
      try {
        if (!n.read) await markRead.mutateAsync(n.id);
      } catch {
        /* still navigate */
      }
      setOpen(false);
      router.push(notificationActionHref(n));
    },
    [markRead, router],
  );

  const rows = (notifications.data ?? []).slice(0, 10);
  const listError = notifications.isError
    ? getApiErrorMessage(notifications.error)
    : null;

  const sheetBottom = navVisible
    ? `calc(${navBottomOffset} + 3.25rem)`
    : navBottomOffset;

  const panelHeader = (
    <motion.div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 md:py-2">
      <p className="text-sm font-semibold text-white md:text-xs">
        Notifications
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={markAllRead.isPending || count === 0}
          onClick={() => markAllRead.mutate()}
          className="text-[11px] font-semibold text-[#00C9B1] hover:underline disabled:opacity-40"
        >
          Mark all read
        </button>
        <button
          type="button"
          className="rounded-md p-1.5 text-white/50 hover:bg-white/[0.06] hover:text-white md:hidden"
          aria-label="Close notifications"
          onClick={() => setOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );

  const panelBody = (
    <motion.div
      ref={listRef}
      className="max-h-[min(58dvh,520px)] overflow-y-auto overscroll-contain md:max-h-[min(70vh,360px)]"
      onWheelCapture={(e) => {
        const el = listRef.current;
        if (!el) return;
        const canScroll = el.scrollHeight > el.clientHeight;
        if (!canScroll) return;
        e.preventDefault();
        e.stopPropagation();
        el.scrollTop += e.deltaY;
      }}
      onTouchMoveCapture={(e) => e.stopPropagation()}
    >
      {notifications.isLoading ? (
        <motion.div className="flex items-center justify-center gap-2 py-10 text-sm text-white/50">
          <Loader2 className="h-5 w-5 animate-spin text-[#00C9B1]" />
          Loading…
        </motion.div>
      ) : listError ? (
        <p className="px-3 py-4 text-sm text-rose-300">{listError}</p>
      ) : rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-white/50">
          You&apos;re all caught up! 🎉
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {rows.map((n) => {
            const parts = splitNotificationMessage(n.message);
            return (
              <li key={n.id}>
                <motion.div
                  className={cn(
                    'px-3 py-3 transition hover:bg-white/[0.03]',
                    !n.read &&
                      'border-l-2 border-[#00C9B1] pl-[calc(0.75rem-2px)]',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-1 h-2 w-2 shrink-0 rounded-full',
                        n.read ? 'bg-white/20' : 'bg-[#00C9B1]',
                      )}
                      aria-hidden
                    />
                    <motion.div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-white/95">
                        {parts.title}
                      </p>
                      {!n.read ? (
                        <span className="mt-1 inline-flex w-fit items-center rounded-full border border-[#00C9B1]/40 bg-[#00C9B1]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7AF7F7]">
                          New
                        </span>
                      ) : null}
                      {parts.detail ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/60">
                          {parts.detail}
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-[11px] text-white/40">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => void onNotificationClick(n)}
                          className="rounded-md border border-[#00C9B1]/35 bg-[#00C9B1]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#66F3F3] transition hover:bg-[#00C9B1]/20 sm:py-1"
                        >
                          {notificationActionLabel(n)}
                        </button>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              </li>
            );
          })}
        </ul>
      )}
    </motion.div>
  );

  return (
    <div className="relative shrink-0" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-white/60 transition-colors hover:text-[#00C9B1]"
        aria-expanded={open}
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {badge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white">
            {badge}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Close notifications"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[118] bg-black/55 md:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2 }}
              style={{ bottom: sheetBottom }}
              className="fixed inset-x-0 z-[119] overflow-hidden rounded-t-2xl border border-white/10 bg-[#0C0F0F] pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.45)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-[min(calc(100vw-1.5rem),22rem)] md:rounded-xl md:pb-0 md:shadow-xl"
              onMouseDownCapture={(e) => e.stopPropagation()}
              onTouchStartCapture={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-white/20 md:hidden" />
              {panelHeader}
              {panelBody}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
