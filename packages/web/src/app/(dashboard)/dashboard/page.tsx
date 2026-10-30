'use client';

import { Suspense } from 'react';

import { DashboardHome } from '@/components/dashboard/home/DashboardHome';

/**
 * Home. The previous all-in-one overview (`DashboardOverviewContent`) is kept
 * in the codebase but no longer rendered; it stacked ~30 sections on one page.
 */
export default function DashboardHomePage() {
  return (
    <Suspense fallback={null}>
      <DashboardHome />
    </Suspense>
  );
}
