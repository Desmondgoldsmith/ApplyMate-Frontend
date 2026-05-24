'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { DashboardMainContext } from '@/components/dashboard/DashboardMainContext';
import { useMobileShell } from '@/components/dashboard/MobileShellContext';
import { cn } from '@/lib/utils';

/** Home overview uses split panes with independent scroll on large screens. */
function isDashboardOverviewPath(pathname: string): boolean {
  const p = pathname.split('?')[0] ?? pathname;
  return p === '/dashboard' || p === '/dashboard/';
}

function isCvClinicPath(pathname: string): boolean {
  const p = pathname.split('?')[0] ?? pathname;
  return p === '/dashboard/cv' || p.startsWith('/dashboard/cv/');
}

export function DashboardMain({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const overviewSplit = isDashboardOverviewPath(pathname);
  const cvClinicMobile = isCvClinicPath(pathname);
  const { navVisible } = useMobileShell();

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <DashboardMainContext.Provider value={mainRef}>
      <main
        ref={mainRef}
        className={cn(
          'dashboard-app-canvas-bg relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overscroll-y-contain px-4 py-4 pt-4 sm:px-5 sm:py-5 md:py-8 lg:pb-8',
          cvClinicMobile &&
            'max-lg:px-0 max-lg:py-0 max-lg:pt-0 max-lg:pb-0 max-lg:overflow-hidden',
          navVisible
            ? 'pb-[max(6.25rem,calc(5.25rem+env(safe-area-inset-bottom)))] sm:pb-28'
            : 'pb-[max(1.25rem,calc(0.75rem+env(safe-area-inset-bottom)))] max-lg:pb-4',
          overviewSplit
            ? 'scroll-content-end-pad overflow-y-auto lg:overflow-hidden'
            : cvClinicMobile
              ? 'lg:overflow-y-auto'
              : 'scroll-content-end-pad overflow-y-auto',
        )}
        data-lenis-prevent
      >
        {children}
      </main>
    </DashboardMainContext.Provider>
  );
}
