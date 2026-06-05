'use client';

import { DashboardCareerMomentumCard } from '@/components/dashboard/DashboardCareerMomentumCard';
import {
  deepDiveCareerMomentumSummary,
  wrapProgressCore,
} from '@/components/dashboard/overview/dashboardOverviewHelpers';
import { useDashboardTodayPlanQuery } from '@/hooks/useDashboardTodayPlanQuery';
import { dashboardEmptyStateFor } from '@/lib/today-plan';

/** Career momentum card with its own today-plan query (deduped with overview). */
export function CareerMomentumSection() {
  const todayPlan = useDashboardTodayPlanQuery();
  const payload = todayPlan.data?.careerMomentum;
  if (!payload) return null;

  return wrapProgressCore(
    'career_momentum',
    deepDiveCareerMomentumSummary(payload),
    <DashboardCareerMomentumCard
      data={payload}
      phase15Empty={dashboardEmptyStateFor(todayPlan.data, 'career_momentum')}
    />,
  );
}
