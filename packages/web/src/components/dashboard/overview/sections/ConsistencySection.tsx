'use client';

import { DashboardHabitProgressCard } from '@/components/dashboard/DashboardHabitProgressCard';
import {
  deepDiveHabitSummary,
  wrapProgressCore,
} from '@/components/dashboard/overview/dashboardOverviewHelpers';
import { useDashboardTodayPlanQuery } from '@/hooks/useDashboardTodayPlanQuery';

/** Habit / consistency progress with its own today-plan query (deduped with overview). */
export function ConsistencySection() {
  const todayPlan = useDashboardTodayPlanQuery();
  const payload = todayPlan.data?.habitProgress;
  if (!payload) return null;

  return wrapProgressCore(
    'habit_progress',
    deepDiveHabitSummary(payload),
    <DashboardHabitProgressCard data={payload} />,
  );
}
