'use client';

import { Suspense } from 'react';

import { AiUsageBadge } from '@/components/dashboard/AiUsageBadge';
import { DashboardBreadcrumbs } from '@/components/dashboard/DashboardBreadcrumbs';
import { DashboardUserMenu } from '@/components/dashboard/DashboardUserMenu';
import { HelpMenu } from '@/components/dashboard/HelpMenu';
import { NotificationBell } from '@/components/dashboard/NotificationBell';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export function Header() {
  return (
    <header className="sticky top-0 z-[60] flex h-16 min-h-[64px] shrink-0 items-center justify-between gap-2 border-b border-border-subtle bg-bg-surface px-3 sm:gap-3 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Suspense
          fallback={
            <p className="min-w-0 truncate text-[17px] font-semibold tracking-tight text-text-primary sm:text-[18px]">
              Home
            </p>
          }
        >
          <DashboardBreadcrumbs className="min-w-0 flex-1" />
        </Suspense>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2.5">
        <AiUsageBadge
          variant="compact"
          className="hidden min-w-0 max-w-[15rem] md:inline-flex"
        />
        <ThemeToggle className="hidden shadow-none sm:inline-flex" />
        <HelpMenu />
        <NotificationBell />
        <DashboardUserMenu />
      </div>
    </header>
  );
}
