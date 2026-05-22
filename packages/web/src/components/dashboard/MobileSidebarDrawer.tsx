'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  getVisibleDashboardNavItems,
  isDashboardNavActive,
  isDashboardNavEntryActive,
  type DashboardNavItem,
} from '@/components/dashboard/dashboardNavConfig';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { api } from '@/lib/api';
import { clearJobHubBrowserStorage } from '@/lib/jobHubClear';
import { getDisplayInitials, getDisplayName } from '@/lib/display-name';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function MobileSidebarDrawer({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const storeUser = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const { data: me } = useCurrentUser();
  const user = me ?? storeUser ?? undefined;
  const features = user?.selectedFeatures ?? ['cv'];
  const items = getVisibleDashboardNavItems(features);
  const displayName = getDisplayName(user);
  const initials = getDisplayInitials(user);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(true);

  const jobSuite = items.find((i) => i.id === 'job-workspace');

  useEffect(() => {
    if (jobSuite?.children?.length && isDashboardNavEntryActive(pathname, jobSuite)) {
      setJobsOpen(true);
    }
  }, [pathname, jobSuite]);

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
      onClose();
      router.push('/login');
    },
  });

  const renderLeafDrawer = (item: DashboardNavItem, nested: boolean) => {
    const Icon = item.icon;
    const active = isDashboardNavActive(pathname, item.href);
    const soon = Boolean(item.comingSoon && item.feature);
    const tourAttr =
      item.id === 'job-board' ? 'nav-job-board' : item.id === 'job-analyze' ? 'nav-job-analyzer' : undefined;
    return (
      <Link
        key={item.id + item.href}
        href={item.href}
        onClick={onClose}
        {...(tourAttr ? { 'data-tour': tourAttr } : {})}
        className={cn(
          'flex min-h-[48px] items-center gap-3 rounded-[10px] py-2.5 text-[14px] font-medium transition-colors',
          nested ? 'pl-6 pr-3' : 'px-3',
          active
            ? 'border-l-2 border-[#00C9B1] bg-[#00C9B1]/12 text-[#00C9B1]'
            : 'border-l-2 border-transparent text-white/45 hover:bg-white/[0.05] hover:text-white/80',
        )}
      >
        <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-[#00C9B1]' : 'text-white/45')} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {soon ? (
          <span className="shrink-0 rounded-full bg-[#00C9B1]/15 px-1.5 py-px text-[9px] font-semibold uppercase text-[#00C9B1]">
            Soon
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.aside
            className="fixed inset-y-0 left-0 z-[70] flex w-[min(88vw,300px)] max-w-[300px] flex-col border-r border-[#00C9B1]/15 bg-[#0A0A0A]/98 shadow-2xl backdrop-blur-md lg:hidden"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-[#00C9B1]" />
                <span className="text-[15px] font-semibold text-white/90">ApplyMate</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3 app-scrollbar" aria-label="Main">
              {items.map((item) => {
                if (item.id === 'job-workspace' && item.children?.length) {
                  const groupActive = isDashboardNavEntryActive(pathname, item);
                  return (
                    <div key={item.id} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={() => setJobsOpen((v) => !v)}
                        className={cn(
                          'flex w-full min-h-[48px] items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-medium transition-colors',
                          groupActive
                            ? 'bg-[#00C9B1]/10 text-[#00C9B1]'
                            : 'text-white/45 hover:bg-white/[0.05] hover:text-white/80',
                        )}
                        aria-expanded={jobsOpen}
                      >
                        <item.icon className={cn('h-5 w-5 shrink-0', groupActive ? 'text-[#00C9B1]' : 'text-white/45')} />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <ChevronDown
                          className={cn('h-4 w-4 shrink-0 text-white/35 transition-transform', jobsOpen && 'rotate-180')}
                        />
                      </button>
                      {jobsOpen ? (
                        <div className="space-y-0.5 border-l border-white/[0.06] ml-3 pl-1">
                          {item.children.map((ch) => renderLeafDrawer(ch, true))}
                        </div>
                      ) : null}
                    </div>
                  );
                }
                return renderLeafDrawer(item, false);
              })}
            </nav>

            <div className="border-t border-[#00C9B1]/10 p-4">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00C9B1]/20 text-[11px] font-bold text-[#00C9B1]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-white">{displayName}</p>
                  <p className="truncate text-xs text-white/40">{user?.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLogoutOpen(true)}
                className="flex w-full min-h-[44px] items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-white/45 hover:bg-white/[0.05] hover:text-white/75"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

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
    </>
  );
}
