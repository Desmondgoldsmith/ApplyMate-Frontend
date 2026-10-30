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
  'interviews',
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
              className="fixed inset-0 z-[42] bg-bg-overlay lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMoreOpen(false)}
            />
            <motion.div
              style={{ bottom: submenuBottom }}
              data-tour="mobile-more-sheet"
              className="fixed inset-x-0 z-[43] mx-2 rounded-2xl border border-accent-border bg-bg-surface p-2 shadow-overlay backdrop-blur-md lg:hidden"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mb-1 flex items-center justify-between px-2 py-1">
                <p className="text-[13px] font-semibold text-text-secondary">
                  More
                </p>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="rounded-md border border-border-default p-1.5 text-text-tertiary hover:border-accent-border hover:bg-accent-subtle hover:text-accent-text"
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
                        'flex min-h-[3.7rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-tight text-text-tertiary transition-colors',
                        active &&
                          'bg-accent-subtle text-text-primary shadow-[inset_0_0_0_1px_var(--ck-accent-border)]',
                        !active &&
                          'hover:bg-bg-hover hover:text-text-secondary',
                        soon && 'opacity-75',
                      )}
                      onClick={() => setMoreOpen(false)}
                    >
                      <Icon
                        className={cn(
                          'h-[17px] w-[17px] shrink-0',
                          active ? 'text-accent-text' : 'text-text-tertiary',
                        )}
                      />
                      <span className="line-clamp-2 w-full text-center">
                        {item.shortLabel}
                      </span>
                      {soon ? (
                        <span className="text-[10px] font-semibold text-accent-text">
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
              className="fixed inset-0 z-[42] bg-bg-overlay lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setJobsMenuOpen(false)}
            />
            <motion.div
              style={{ bottom: submenuBottom }}
              data-tour="mobile-jobs-sheet"
              className="fixed inset-x-0 z-[43] mx-2 max-h-[min(70vh,420px)] overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-overlay backdrop-blur-md lg:hidden"
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 16, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
                <p className="text-[15px] font-semibold text-text-primary">
                  Jobs
                </p>
                <button
                  type="button"
                  onClick={() => setJobsMenuOpen(false)}
                  className="rounded-md border border-border-default p-1.5 text-text-tertiary hover:border-accent-border hover:bg-accent-subtle hover:text-accent-text"
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
                          'flex h-[60px] w-full min-w-0 items-center gap-3 rounded-[10px] border border-border-subtle bg-bg-surface px-3 text-[13px] font-medium text-text-secondary transition-colors',
                          active &&
                            'border-accent-border bg-accent-subtle text-text-primary',
                          !active &&
                            'hover:border-accent-border hover:bg-accent-subtle hover:text-text-primary',
                          soon && 'opacity-75',
                        )}
                        onClick={() => setJobsMenuOpen(false)}
                      >
                        <Icon
                          className={cn(
                            'h-6 w-6 shrink-0',
                            active ? 'text-accent-text' : 'text-text-secondary',
                          )}
                        />
                        <span className="min-w-0 flex-1 text-left">
                          {item.shortLabel}
                        </span>
                        {soon ? (
                          <span className="text-[10px] font-semibold text-accent-text">
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
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-bg-surface pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-overlay backdrop-blur-md lg:hidden"
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
                      data-tour={item.tourAttr}
                      onClick={() => setJobsMenuOpen((v) => !v)}
                      className={cn(
                        'flex min-h-[4.1rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium leading-tight transition-colors active:scale-[0.98]',
                        active
                          ? 'text-accent-text'
                          : 'text-text-tertiary hover:text-text-secondary',
                        !active && 'hover:bg-bg-hover',
                      )}
                      aria-expanded={jobsMenuOpen}
                      aria-haspopup="menu"
                    >
                      <Briefcase
                        className={cn(
                          'h-[18px] w-[18px] shrink-0',
                          active ? 'text-accent-text' : 'text-text-tertiary',
                        )}
                      />
                      <span
                        className={cn(
                          'line-clamp-2 w-full text-center',
                          active && 'text-accent-text',
                        )}
                      >
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
                        ? 'text-accent-text'
                        : 'text-text-tertiary hover:text-text-secondary',
                      !active && 'hover:bg-bg-hover',
                      soon && 'opacity-75',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0',
                        active ? 'text-accent-text' : 'text-text-tertiary',
                      )}
                    />
                    <span className="line-clamp-2 w-full text-center">
                      {item.shortLabel}
                    </span>
                    {soon ? (
                      <span className="text-[10px] font-semibold text-accent-text">
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
                    ? 'text-accent-text'
                    : 'text-text-tertiary hover:text-text-secondary',
                  !(moreActive || moreOpen) && 'hover:bg-bg-hover',
                )}
                aria-label="More navigation options"
                aria-expanded={moreOpen}
                aria-haspopup="menu"
              >
                <MoreHorizontal
                  className={cn(
                    'h-[18px] w-[18px] shrink-0',
                    moreActive || moreOpen
                      ? 'text-accent-text'
                      : 'text-text-tertiary',
                  )}
                />
                <span
                  className={cn(
                    'w-full text-center',
                    (moreActive || moreOpen) && 'text-accent-text',
                  )}
                >
                  More
                </span>
              </button>
            </div>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </>
  );
}
