'use client';

import { DashboardFocusSection } from '@/components/dashboard/DashboardFocusSection';
import { useDashboardTodayPlanQuery } from '@/hooks/useDashboardTodayPlanQuery';
import type { FocusItem } from '@/lib/dashboardFocusMerge';
import {
  dashboardEmptyStateFor,
  normalizedSectionTitle,
} from '@/lib/today-plan';

export type TodaysPlanSectionProps = {
  items: FocusItem[];
};

/** Today&apos;s focus feed (items merged upstream; plan metadata fetched here). */
export function TodaysPlanSection({ items }: TodaysPlanSectionProps) {
  const todayPlan = useDashboardTodayPlanQuery();

  return (
    <DashboardFocusSection
      items={items}
      sectionHeading={normalizedSectionTitle(
        todayPlan.data,
        'focus',
        'Your Focus',
      )}
      phase15Empty={dashboardEmptyStateFor(todayPlan.data, 'focus')}
    />
  );
}
