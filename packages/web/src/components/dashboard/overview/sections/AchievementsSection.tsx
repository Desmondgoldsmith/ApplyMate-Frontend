'use client';

import { DashboardCareerAchievementsSection } from '@/components/dashboard/DashboardCareerAchievementsSection';
import {
  deepDiveCareerAchievementsSummary,
  wrapProgressCore,
} from '@/components/dashboard/overview/dashboardOverviewHelpers';
import { useDashboardTodayPlanQuery } from '@/hooks/useDashboardTodayPlanQuery';
import { dashboardEmptyStateFor } from '@/lib/today-plan';

export type AchievementsSectionProps = {
  heading: string;
};

/** Career achievements digest with its own today-plan query (deduped with overview). */
export function AchievementsSection({ heading }: AchievementsSectionProps) {
  const todayPlan = useDashboardTodayPlanQuery();
  const plan = todayPlan.data;
  if (!plan || (plan.careerAchievements == null && plan.achievements == null)) {
    return null;
  }

  return wrapProgressCore(
    'today_plan_achievements',
    deepDiveCareerAchievementsSummary(
      plan.careerAchievements,
      plan.achievements,
    ),
    <DashboardCareerAchievementsSection
      digestVersion={plan.digestVersion ?? ''}
      career={plan.careerAchievements}
      achievements={plan.achievements}
      heading={heading}
      phase15Empty={dashboardEmptyStateFor(plan, 'achievements')}
    />,
  );
}
