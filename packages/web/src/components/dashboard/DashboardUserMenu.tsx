'use client';

import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { api } from '@/lib/api';
import { clearJobHubBrowserStorage } from '@/lib/jobHubClear';
import { getDisplayInitials, getDisplayName } from '@/lib/display-name';
import { cn } from '@/lib/utils';
import { isMarketingPauseActive } from '@/lib/user-notification-ui';
import { useAuthStore } from '@/store/useAuthStore';

export function DashboardUserMenu({ className }: { className?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const storeUser = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { data: me, isError: meError } = useCurrentUser();
  const user = me ?? storeUser ?? undefined;
  const initials = getDisplayInitials(user);
  const name = getDisplayName(user);
  // Same on the server and the first client render, so hydration matches.
  const showUserSkeleton =
    !me &&
    !meError &&
    (!storeUser?.email || getDisplayInitials(storeUser) === 'U');
  const marketingPaused = isMarketingPauseActive(user?.nudgePausedUntil);
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      queryClient.clear();
      clearJobHubBrowserStorage();
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      clearAuth();
      router.push('/login');
    },
  });

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-full border border-border-subtle bg-accent-subtle text-[11px] font-semibold text-accent-text transition-colors hover:border-accent-border hover:bg-accent-subtle lg:h-10 lg:min-h-0 lg:w-10 lg:min-w-0"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        {showUserSkeleton ? (
          <Skeleton className="h-full w-full rounded-full" />
        ) : (
          initials
        )}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-64 overflow-hidden rounded-xl border border-border-subtle bg-bg-surface py-1 shadow-overlay"
          role="menu"
        >
          <div className="border-b border-border-subtle px-3 py-2">
            <p className="truncate text-[14px] font-semibold text-text-primary">
              {name}
            </p>
            {user?.email ? (
              <p className="truncate text-[12px] text-text-secondary">
                {user.email}
              </p>
            ) : null}
            {marketingPaused ? (
              <Link
                href="/dashboard/settings?tab=notifications"
                className="mt-1 block truncate text-[11px] text-warning-text hover:underline"
                onClick={() => setOpen(false)}
              >
                Marketing nudges paused
              </Link>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2.5">
            <span className="text-[13px] font-medium text-text-secondary">
              Theme
            </span>
            <ThemeToggle className="shadow-none" />
          </div>
          <Link
            href="/dashboard/settings"
            role="menuitem"
            className="flex min-h-[44px] items-center gap-2 px-3 py-2 text-[14px] font-medium text-text-primary transition-colors hover:bg-bg-hover"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 text-text-tertiary" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full min-h-[44px] items-center gap-2 px-3 py-2 text-left text-[14px] font-medium text-text-primary transition-colors hover:bg-bg-hover"
            onClick={() => {
              setOpen(false);
              setLogoutOpen(true);
            }}
          >
            <LogOut className="h-4 w-4 text-text-tertiary" />
            Sign out
          </button>
        </div>
      ) : null}

      <ConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Sign out?"
        description="You will need to sign in again to use CareerKite."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        isPending={logoutMutation.isPending}
        onConfirm={() => logoutMutation.mutateAsync()}
      />
    </div>
  );
}
