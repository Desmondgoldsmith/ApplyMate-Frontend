'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Briefcase, MoreHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import {
  getVisibleDashboardNavItems,
  isDashboardNavActive,
  type DashboardNavItem,
} from '@/components/dashboard/dashboardNavConfig';
import { useMobileShell } from '@/components/dashboard/MobileShellContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

const PRIMARY_MOBILE_NAV_IDS = [
  'overview',
  'job-workspace',
  'cv',
  'cv-profiles',
] as const;

export function MobileBottomNav() {
  const { navVisible, navBottomOffset } = useMobileShell();
  const pathname = usePathname();
  const storeUser = useAuthStore((s) => s.user);
  const { data: me } = useCurrentUser();
  const user = me ?? storeUser ?? undefined;
  const features = user?.selectedFeatures ?? ['cv'];
  const items = getVisibleDashboardNavItems(features);
  const [moreOpen, setMoreOpen] = useState(false);
  const [jobsMenuOpen, setJobsMenuOpen] = useState(false);

  const jobSuite = useMemo(
    () => items.find((i) => i.id === 'job-workspace'),
    [items],
  );

  const primaryItems = useMemo(
    () =>
      PRIMARY_MOBILE_NAV_IDS.map((id) =>
        items.find((item) => item.id === id),
      ).filter((item): item is DashboardNavItem => Boolean(item)),
    [items],
  );

  const extraItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !PRIMARY_MOBILE_NAV_IDS.includes(
            item.id as (typeof PRIMARY_MOBILE_NAV_IDS)[number],
          ),
      ),
    [items],
  );

  const moreActive = extraItems.some((item) =>
    isDashboardNavActive(pathname, item.href),
  );
  useEffect(() => {
    const openJobs = () => setJobsMenuOpen(true);
    const closeJobs = () => setJobsMenuOpen(false);
    const closeMore = () => setMoreOpen(false);
    const openMore = () => {
      setJobsMenuOpen(false);
      setMoreOpen(true);
    };
    window.addEventListener('applymate:tour-open-jobs-nav', openJobs);
    window.addEventListener('applymate:tour-close-jobs-nav', closeJobs);
    window.addEventListener('applymate:tour-close-more-nav', closeMore);
    window.addEventListener('applymate:tour-open-more-nav', openMore);
    return () => {
      window.removeEventListener('applymate:tour-open-jobs-nav', openJobs);
      window.removeEventListener('applymate:tour-close-jobs-nav', closeJobs);
      window.removeEventListener('applymate:tour-close-more-nav', closeMore);
      window.removeEventListener('applymate:tour-open-more-nav', openMore);
    };
  }, []);

  const submenuBottom = navVisible
    ? `calc(${navBottomOffset} + 4.9rem)`
    : `calc(${navBottomOffset} + 3.25rem)`;

  const jobsChildActive =
    jobSuite?.children?.some((c) => isDashboardNavActive(pathname, c.href)) ??
    false;

  useEffect(() => {
    setMoreOpen(false);
    setJobsMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <AnimatePresence>
        {moreOpen && extraItems.length ? (
          <>
            <motion.button
              type="button"
              aria-label="Close more menu"
              className="fixed inset-0 z-[42] bg-black/55 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              style={{ bottom: submenuBottom }}
              data-tour="mobile-more-sheet"
              className="fixed inset-x-0 z-[43] mx-2 rounded-2xl border border-[#00C9B1]/30 bg-[#0C0F0F]/98 p-2 shadow-[0_-10px_28px_rgba(0,0,0,0.38)] backdrop-blur-md lg:hidden"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-1 flex items-center justify-between px-2 py-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/45">
                  More
                </p>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="rounded-md border border-white/12 p-1.5 text-white/55 hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/15 hover:text-[#00C9B1]"
                  aria-label="Close more menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {extraItems.map((item) => {
                  const Icon = item.icon;
                  const active = isDashboardNavActive(pathname, item.href);
                  const soon = Boolean(item.comingSoon && item.feature);
                  const tourAttr = item.tourAttr;
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      {...(tourAttr ? { 'data-tour': tourAttr } : {})}
                      className={cn(
                        'flex min-h-[3.7rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-tight text-white/55 transition-colors',
                        active &&
                          'bg-[#00C9B1]/18 text-white shadow-[inset_0_0_0_1px_rgba(0,201,177,0.35)]',
                        !active && 'hover:bg-white/[0.06] hover:text-white/80',
                        soon && 'opacity-75',
                      )}
                      onClick={() => setMoreOpen(false)}
                    >
                      <Icon
                        className={cn(
                          'h-[17px] w-[17px] shrink-0',
                          active ? 'text-[#00C9B1]' : 'text-[rgba(240,244,242,0.35)]',
                        )}
                      />
                      <span className="line-clamp-2 w-full text-center">
                        {item.shortLabel}
                      </span>
                      {soon ? (
                        <span className="text-[8px] font-semibold uppercase tracking-wide text-[#00C9B1]">
                          Soon
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {jobsMenuOpen && jobSuite?.children?.length ? (
          <>
            <motion.button
              type="button"
              aria-label="Close jobs menu"
              className="fixed inset-0 z-[42] bg-black/55 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setJobsMenuOpen(false)}
            />
            <motion.div
              style={{ bottom: submenuBottom }}
              data-tour="mobile-jobs-sheet"
              className="fixed inset-x-0 z-[43] mx-2 max-h-[min(70vh,420px)] overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#0F1512] shadow-[0_-10px_28px_rgba(0,0,0,0.38)] backdrop-blur-md lg:hidden"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-3 py-2.5">
                <p className="text-[15px] font-semibold text-[#F0F4F2]">Jobs</p>
                <button
                  type="button"
                  onClick={() => setJobsMenuOpen(false)}
                  className="rounded-md border border-white/12 p-1.5 text-white/55 hover:border-[#00C9B1]/40 hover:bg-[rgba(0,201,177,0.05)] hover:text-[#00C9B1]"
                  aria-label="Close jobs menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="app-scrollbar scroll-content-end-pad max-h-[min(58vh,340px)] overflow-y-auto p-2 pb-4">
                <div className="flex flex-col gap-2">
                  {jobSuite.children.map((item) => {
                    const Icon = item.icon;
                    const active = isDashboardNavActive(pathname, item.href);
                    const soon = Boolean(item.comingSoon && item.feature);
                    const tourAttr = item.tourAttr;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        {...(tourAttr ? { 'data-tour': tourAttr } : {})}
                        className={cn(
                          'flex h-[60px] w-full min-w-0 items-center gap-3 rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[#0F1512] px-3 text-[13px] font-medium text-[rgba(240,244,242,0.60)] transition-colors',
                          active &&
                            'border-[#00C9B1]/40 bg-[rgba(0,201,177,0.05)] text-[#F0F4F2]',
                          !active &&
                            'hover:border-[#00C9B1]/40 hover:bg-[rgba(0,201,177,0.05)] hover:text-[#F0F4F2]',
                          soon && 'opacity-75',
                        )}
                        onClick={() => setJobsMenuOpen(false)}
                      >
                        <Icon
                          className={cn(
                            'h-6 w-6 shrink-0',
                            active ? 'text-[#00C9B1]' : 'text-[rgba(240,244,242,0.60)]',
                          )}
                        />
                        <span className="min-w-0 flex-1 text-left">{item.shortLabel}</span>
                        {soon ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#00C9B1]">
                            Soon
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {navVisible ? (
          <motion.nav
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-[rgba(255,255,255,0.08)] bg-[#0F1512]/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md lg:hidden"
            aria-label="Main navigation"
            data-tour="mobile-bottom-nav"
          >
            <div
              className="grid gap-0.5 px-1"
              style={{
                gridTemplateColumns: `repeat(${Math.max(2, primaryItems.length + 1)}, minmax(0, 1fr))`,
              }}
            >
              {primaryItems.map((item) => {
                if (item.id === 'job-workspace') {
                  const active = jobsChildActive || jobsMenuOpen;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-tour="nav-jobs-workspace"
                      onClick={() => setJobsMenuOpen((v) => !v)}
                      className={cn(
                        'flex min-h-[4.1rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors active:scale-[0.98]',
                        active ? 'text-[#00C9B1]' : 'text-[rgba(240,244,242,0.35)] hover:text-[rgba(240,244,242,0.60)]',
                        !active && 'hover:bg-white/[0.04]',
                      )}
                      aria-expanded={jobsMenuOpen}
                      aria-haspopup="menu"
                    >
                      <Briefcase
                        className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          active ? 'text-[#00C9B1]' : 'text-[rgba(240,244,242,0.35)]',
                        )}
                      />
                      <span className={cn('line-clamp-2 w-full text-center', active && 'text-[#00C9B1]')}>
                        {item.shortLabel}
                      </span>
                    </button>
                  );
                }
                const Icon = item.icon;
                const active = isDashboardNavActive(pathname, item.href);
                const soon = Boolean(item.comingSoon && item.feature);
                const tourAttr = item.tourAttr;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    {...(tourAttr ? { 'data-tour': tourAttr } : {})}
                      className={cn(
                        'flex min-h-[4.1rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors active:scale-[0.98]',
                        active
                          ? 'text-[#00C9B1]'
                          : 'text-[rgba(240,244,242,0.35)] hover:text-[rgba(240,244,242,0.60)]',
                        !active && 'hover:bg-white/[0.04]',
                        soon && 'opacity-75',
                      )}
                  >
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0',
                        active ? 'text-[#00C9B1]' : 'text-[rgba(240,244,242,0.35)]',
                      )}
                    />
                    <span className="line-clamp-2 w-full text-center">
                      {item.shortLabel}
                    </span>
                    {soon ? (
                      <span className="text-[8px] font-semibold uppercase tracking-wide text-[#00C9B1]">
                        Soon
                      </span>
                    ) : null}
                  </Link>
                );
              })}

              <button
                type="button"
                data-tour="nav-more-menu"
                onClick={() => setMoreOpen((v) => !v)}
                className={cn(
                  'flex min-h-[4.1rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors',
                  moreActive || moreOpen
                    ? 'text-[#00C9B1]'
                    : 'text-[rgba(240,244,242,0.35)] hover:text-[rgba(240,244,242,0.60)]',
                  !(moreActive || moreOpen) && 'hover:bg-white/[0.04]',
                )}
                aria-label="More navigation options"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                <MoreHorizontal
                  className={cn(
                    'h-[18px] w-[18px] shrink-0',
                    moreActive || moreOpen ? 'text-[#00C9B1]' : 'text-[rgba(240,244,242,0.35)]',
                  )}
                />
                <span className={cn('w-full text-center', (moreActive || moreOpen) && 'text-[#00C9B1]')}>More</span>
              </button>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </>
  );
}
