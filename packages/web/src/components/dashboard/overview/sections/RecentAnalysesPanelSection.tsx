'use client';

import { RecentAnalysesPanel } from '@/components/dashboard/overview/RecentAnalysesPanel';
import { useJobHistory } from '@/hooks/useJobHistory';
import { useDashboardTodayPlanQuery } from '@/hooks/useDashboardTodayPlanQuery';

export type RecentAnalysesPanelSectionProps = {
  onRefreshPriorities?: () => void;
};

/** Sticky recent analyses column; fetches job history via React Query. */
export function RecentAnalysesPanelSection({
  onRefreshPriorities,
}: RecentAnalysesPanelSectionProps) {
  const history = useJobHistory();
  const todayPlan = useDashboardTodayPlanQuery();

  return (
    <RecentAnalysesPanel
      history={history}
      onRefreshPriorities={() => {
        void todayPlan.refetch();
        void history.refetch();
        onRefreshPriorities?.();
      }}
    />
  );
}
