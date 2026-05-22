'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';
import { usePathname } from 'next/navigation';

import { DashboardMainContext } from '@/components/dashboard/DashboardMainContext';
import { cn } from '@/lib/utils';

/** Home overview uses split panes with independent scroll on large screens. */
function isDashboardOverviewPath(pathname: string): boolean {
  const p = pathname.split('?')[0] ?? pathname;
  return p === '/dashboard' || p === '/dashboard/';
}

export function DashboardMain({ children }: { children: ReactNode }) {
  const mainRef = useRef<HTMLElement | null>(null);
  const pathname = usePathname();
  const overviewSplit = isDashboardOverviewPath(pathname);

  return (
    <DashboardMainContext.Provider value={mainRef}>
      <main
        ref={mainRef}
        className={cn(
          'dashboard-app-canvas-bg relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overscroll-y-contain px-4 py-4 pb-[max(6.25rem,calc(5.25rem+env(safe-area-inset-bottom)))] pt-4 sm:px-5 sm:py-5 sm:pb-28 md:py-8 lg:pb-8',
          overviewSplit ? 'overflow-y-auto lg:overflow-hidden' : 'overflow-y-auto',
        )}
        data-lenis-prevent
      >
        {children}
      </main>
    </DashboardMainContext.Provider>
  );
}
