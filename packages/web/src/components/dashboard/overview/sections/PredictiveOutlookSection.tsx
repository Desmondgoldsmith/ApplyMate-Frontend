'use client';

import { DashboardPredictiveOutlookCard } from '@/components/dashboard/DashboardPredictiveOutlookCard';
import {
  deepDivePredictiveSummary,
  wrapProgressCore,
} from '@/components/dashboard/overview/dashboardOverviewHelpers';
import { useDashboardTodayPlanQuery } from '@/hooks/useDashboardTodayPlanQuery';
import { dashboardEmptyStateFor } from '@/lib/today-plan';

/** Predictive outlook card with its own today-plan query (deduped with overview). */
export function PredictiveOutlookSection() {
  const todayPlan = useDashboardTodayPlanQuery();
  const payload = todayPlan.data?.predictiveOutlook;
  if (!payload) return null;

  return wrapProgressCore(
    'predictive_outlook',
    deepDivePredictiveSummary(payload),
    <DashboardPredictiveOutlookCard
      data={payload}
      phase15Empty={dashboardEmptyStateFor(todayPlan.data, 'predictive_outlook')}
    />,
  );
}
