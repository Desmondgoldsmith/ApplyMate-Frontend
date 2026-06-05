'use client';

import { Suspense } from 'react';

import { DashboardOverviewContent } from '@/components/dashboard/overview/DashboardOverviewContent';
import { DashboardOverviewLoadingSkeleton } from '@/components/dashboard/overview/DashboardOverviewLoadingSkeleton';

/** Dashboard overview — layout shell; sections live in `DashboardOverviewContent`. */
export default function DashboardOverviewPage() {
  return (
    <Suspense fallback={<DashboardOverviewLoadingSkeleton />}>
      <DashboardOverviewContent />
    </Suspense>
  );
}
