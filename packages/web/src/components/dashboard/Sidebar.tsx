'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, PanelLeftClose, PanelRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Skeleton } from '@/components/ui/Skeleton';
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
import { useUIStore } from '@/store/useUIStore';

function CollapsedNavFlyout({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const measure = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.top + r.height / 2,
      left: r.right + 12,
    });
  };

  useLayoutEffect(() => {
    if (!hover) return;
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [hover]);

  const tooltip =
    hover && pos && typeof document !== 'undefined'
      ? createPortal(
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: 'translateY(-50%)',
              zIndex: 100_000,
            }}
            className={cn(
              'pointer-events-none w-max max-w-[240px] select-none',
              'rounded-lg border border-[#00C9B1]/50 bg-[#051815] px-3 py-2 text-left text-[12px] font-medium leading-snug text-[#e6fdf9]/95',
              'shadow-[0_10px_40px_rgba(0,201,177,0.18)] ring-1 ring-[#00C9B1]/20',
            )}
          >
            {label}
          </span>,
          document.body,
        )
      : null;

  return (
    <span
      ref={wrapRef}
      className="relative flex w-full justify-center"
      onMouseEnter={() => {
        setHover(true);
        requestAnimationFrame(measure);
      }}
      onMouseLeave={() => setHover(false)}
      onFocus={() => {
        setHover(true);
        requestAnimationFrame(measure);
      }}
      onBlur={() => setHover(false)}
    >
      {children}
      {tooltip}
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { user: storeUser, clearAuth } = useAuthStore();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [jobsOpen, setJobsOpen] = useState(true);
  const [uiHydrated, setUiHydrated] = useState(false);

  useEffect(() => {
    if (useUIStore.persist.hasHydrated()) {
      setUiHydrated(true);
      return;
    }
    return useUIStore.persist.onFinishHydration(() => setUiHydrated(true));
  }, []);

  const collapsed = uiHydrated ? sidebarCollapsed : true;

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
  const { data: me, isLoading: meLoading } = useCurrentUser();
  const user = me ?? storeUser ?? undefined;
  const displayName = getDisplayName(user);
  const initials = getDisplayInitials(user);
  const showUserSkeleton =
    meLoading && !me && (!storeUser?.email || getDisplayInitials(storeUser) === 'U');

  const features = user?.selectedFeatures ?? ['cv'];

  const visibleItems = getVisibleDashboardNavItems(features);
  const jobSuite = visibleItems.find((i) => i.id === 'job-workspace');

  useEffect(() => {
    if (
      jobSuite?.children?.length &&
      isDashboardNavEntryActive(pathname, jobSuite)
    ) {
      setJobsOpen(true);
    }
  }, [pathname, jobSuite]);

  useEffect(() => {
    const openJobs = () => setJobsOpen(true);
    window.addEventListener('applymate:tour-open-jobs-nav', openJobs);
    return () =>
      window.removeEventListener('applymate:tour-open-jobs-nav', openJobs);
  }, []);

  const renderLeaf = (item: DashboardNavItem, opts: { nested?: boolean }) => {
    const Icon = item.icon;
    const active = isDashboardNavActive(pathname, item.href);
    const showSoonBadge = Boolean(item.comingSoon && item.feature);
    const tourAttr = item.tourAttr;
    const link = (
      <Link
        href={item.href}
        {...(tourAttr ? { 'data-tour': tourAttr } : {})}
        className={cn(
          'relative flex min-h-[40px] w-full items-center gap-2 rounded-[10px] py-2 text-[13px] font-medium transition-colors',
          collapsed && !opts.nested
            ? 'justify-center px-0 text-white/45 hover:bg-white/[0.05] hover:text-white/80'
            : active
              ? cn(
                  'border-l-2 border-[#00C9B1] bg-[rgba(0,201,177,0.12)] text-[#00C9B1]',
                  opts.nested ? 'pl-8 pr-2' : 'pl-[10px]',
                )
              : cn(
                  'border-l-2 border-transparent text-white/45 hover:bg-white/[0.05] hover:text-white/80',
                  opts.nested ? 'pl-8 pr-2' : 'pl-3',
                ),
          collapsed &&
            !opts.nested &&
            active &&
            'bg-[rgba(0,201,177,0.12)] text-[#00C9B1]',
        )}
      >
        {active && !opts.nested ? (
          <motion.div
            layoutId="activeNav"
            className="absolute inset-0 rounded-[10px]"
          />
        ) : null}
        <Icon
          className={cn(
            'h-[18px] w-[18px] shrink-0',
            active ? 'text-[#00C9B1]' : 'text-white/45',
          )}
        />
        <AnimatePresence>
          {!collapsed || opts.nested ? (
            <motion.span
              className="relative flex min-w-0 flex-1 items-center gap-1.5"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
            >
              <span className="truncate">{item.label}</span>
              {showSoonBadge ? (
                <span className="ml-auto shrink-0 rounded-full bg-[#00C9B1]/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-[#00C9B1]">
                  Soon
                </span>
              ) : null}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </Link>
    );

    if (collapsed && !opts.nested) {
      return (
        <CollapsedNavFlyout key={`${item.href}-${item.id}`} label={item.label}>
          {link}
        </CollapsedNavFlyout>
      );
    }

    return <Fragment key={`${item.href}-${item.id}`}>{link}</Fragment>;
  };

  return (
    <aside
      className={cn(
        'relative z-10 hidden h-screen shrink-0 border-r border-[#00C9B1]/15 bg-[#0A0A0A]/95 backdrop-blur-md transition-[width] duration-300 lg:flex lg:flex-col',
        collapsed ? 'w-[60px]' : 'w-[216px]',
      )}
    >
      <div className="flex items-center justify-between p-4">
        <div
          className={cn(
            'flex items-center gap-2',
            collapsed && 'justify-center',
          )}
        >
          <span className="h-5 w-5 rounded-full bg-[#00C9B1]" />
          {!collapsed ? (
            <span className="font-semibold text-white">ApplyMate</span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="text-white/60 transition-colors hover:text-[#00C9B1]"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelRight className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4 app-scrollbar">
        {visibleItems.map((item) => {
          if (item.id === 'job-workspace' && item.children?.length) {
            const Icon = item.icon;
            const groupActive = isDashboardNavEntryActive(pathname, item);
            if (collapsed) {
              return (
                <div key={item.id} className="space-y-1">
                  {item.children.map((ch) => renderLeaf(ch, { nested: false }))}
                </div>
              );
            }
            return (
              <div key={item.id} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setJobsOpen((o) => !o)}
                  className={cn(
                    'flex w-full min-h-[40px] items-center gap-2 rounded-[10px] border-l-2 py-2 pl-3 pr-2 text-left text-[13px] font-medium transition-colors',
                    groupActive
                      ? 'border-[#00C9B1] bg-[rgba(0,201,177,0.08)] text-[#00C9B1]'
                      : 'border-transparent text-white/45 hover:bg-white/[0.05] hover:text-white/80',
                  )}
                  aria-expanded={jobsOpen}
                >
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0',
                      groupActive ? 'text-[#00C9B1]' : 'text-white/45',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-white/35 transition-transform',
                      jobsOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                <AnimatePresence initial={false}>
                  {jobsOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden space-y-0.5 pl-0"
                    >
                      {item.children.map((ch) =>
                        renderLeaf(ch, { nested: true }),
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          }
          return renderLeaf(item, { nested: false });
        })}
      </nav>

      <div className="border-t border-[#00C9B1]/10 p-3">
        <div className="mb-3 flex items-center gap-2">
          {showUserSkeleton ? (
            <>
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              {!collapsed ? (
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00C9B1]/20 text-[10px] font-bold leading-none text-[#00C9B1]">
                {initials}
              </div>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm text-white">{displayName}</p>
                  <p className="truncate text-xs text-white/45">{user?.email}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
        {collapsed ? (
          <CollapsedNavFlyout label="Sign out">
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] py-2 text-xs text-white/45 hover:bg-white/[0.05] hover:text-white/75"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </CollapsedNavFlyout>
        ) : (
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-white/75"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        )}
      </div>

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
    </aside>
  );
}
