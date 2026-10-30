'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { ForcedThemeScope } from '@/components/theme/ThemeScope';

/** Dashboard routes already built on theme tokens. Everything else stays dark until converted. */
const THEMED_DASHBOARD_ROUTES = new Set(['/dashboard', '/dashboard/']);

export function isThemedDashboardRoute(pathname: string): boolean {
  return THEMED_DASHBOARD_ROUTES.has(pathname.split('?')[0] ?? pathname);
}

/** Pins unconverted dashboard pages to dark; the same wrapper is kept so the shell never remounts. */
export function DashboardThemeGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <ForcedThemeScope theme={isThemedDashboardRoute(pathname) ? null : 'dark'}>
      {children}
    </ForcedThemeScope>
  );
}
