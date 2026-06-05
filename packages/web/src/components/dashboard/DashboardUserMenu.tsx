'use client';

import { LogOut, Settings, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

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
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const user = me ?? storeUser ?? undefined;
  const initials = getDisplayInitials(user);
  const name = getDisplayName(user);
  const showUserSkeleton =
    meLoading && !me && (!storeUser?.email || getDisplayInitials(storeUser) === 'U');
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
        className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-full border border-white/10 bg-[#00C9B1]/15 text-[11px] font-semibold text-[#00C9B1] transition-colors hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/25 lg:h-8 lg:min-h-0 lg:w-8 lg:min-w-0"
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
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-52 overflow-hidden rounded-xl border border-white/10 bg-[#0c1010] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          role="menu"
        >
          <div className="border-b border-white/[0.06] px-3 py-2">
            <p className="truncate text-[13px] font-medium text-white">{name}</p>
            {user?.email ? <p className="truncate text-[11px] text-white/40">{user.email}</p> : null}
            {marketingPaused ? (
              <Link
                href="/dashboard/settings?tab=notifications"
                className="mt-1 block truncate text-[11px] text-amber-200/90 hover:underline"
                onClick={() => setOpen(false)}
              >
                Marketing nudges paused
              </Link>
            ) : null}
          </div>
          <Link
            href="/dashboard/settings"
            role="menuitem"
            className="flex min-h-[44px] items-center gap-2 px-3 py-2 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/[0.05] hover:text-white"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 text-white/45" />
            Profile
          </Link>
          <Link
            href="/dashboard/settings"
            role="menuitem"
            className="flex min-h-[44px] items-center gap-2 px-3 py-2 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/[0.05] hover:text-white"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 text-white/45" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full min-h-[44px] items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-white/80 transition-colors hover:bg-white/[0.05] hover:text-white"
            onClick={() => {
              setOpen(false);
              setLogoutOpen(true);
            }}
          >
            <LogOut className="h-4 w-4 text-white/45" />
            Sign out
          </button>
        </div>
      ) : null}

      <ConfirmModal
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        title="Sign out?"
        description="You will need to sign in again to use ApplyMate."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        isPending={logoutMutation.isPending}
        onConfirm={() => logoutMutation.mutateAsync()}
      />
    </div>
  );
}
