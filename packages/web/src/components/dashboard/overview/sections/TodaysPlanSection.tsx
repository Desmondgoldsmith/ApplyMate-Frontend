'use client';

import { DashboardFocusSection } from '@/components/dashboard/DashboardFocusSection';
import { useDashboardTodayPlanQuery } from '@/hooks/useDashboardTodayPlanQuery';
import type { FocusItem } from '@/lib/dashboardFocusMerge';
import { dashboardEmptyStateFor, normalizedSectionTitle } from '@/lib/today-plan';

export type TodaysPlanSectionProps = {
  items: FocusItem[];
  totalCount?: number | null;
};

/** Today&apos;s focus feed (server-ranked; quiet apps live in a separate section). */
export function TodaysPlanSection({ items, totalCount }: TodaysPlanSectionProps) {
  const todayPlan = useDashboardTodayPlanQuery();

  return (
    <DashboardFocusSection
      items={items}
      totalCount={totalCount ?? todayPlan.data?.focusItemsTotalCount ?? null}
      sectionHeading={normalizedSectionTitle(todayPlan.data, 'focus', 'Your focus')}
      phase15Empty={dashboardEmptyStateFor(todayPlan.data, 'focus')}
    />
  );
}

