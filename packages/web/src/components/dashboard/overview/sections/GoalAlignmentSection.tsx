'use client';

import { DashboardGoalAlignmentCard } from '@/components/dashboard/DashboardGoalAlignmentCard';
import {
  deepDiveGoalSummary,
  wrapProgressCore,
} from '@/components/dashboard/overview/dashboardOverviewHelpers';
import { useDashboardTodayPlanQuery } from '@/hooks/useDashboardTodayPlanQuery';

export type GoalAlignmentSectionProps = {
  /** When true, hide to avoid duplicate coaching surfaces. */
  suppressedByDedupe: boolean;
};

/** Goal alignment card with its own today-plan query (deduped with overview). */
export function GoalAlignmentSection({
  suppressedByDedupe,
}: GoalAlignmentSectionProps) {
  const todayPlan = useDashboardTodayPlanQuery();
  const alignment = todayPlan.data?.goalAlignment;
  if (!alignment || suppressedByDedupe) return null;

  return wrapProgressCore(
    'goal_alignment',
    deepDiveGoalSummary(alignment),
    <DashboardGoalAlignmentCard
      alignment={alignment}
      careerProfile={todayPlan.data?.careerGoalProfile ?? null}
    />,
  );
}
