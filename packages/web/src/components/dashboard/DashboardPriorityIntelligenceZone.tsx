'use client';

import { useMemo } from 'react';

import { DashboardFollowUpIntelligenceCard } from '@/components/dashboard/DashboardFollowUpIntelligenceCard';
import { DashboardOpportunityDetectionCard } from '@/components/dashboard/DashboardOpportunityDetectionCard';
import { StrategicRecommendationCard } from '@/components/dashboard/StrategicRecommendationCard';
import type { ResolvedDashboardPhase14Layout } from '@/lib/dashboardPhase14Layout';
import { selectActionablePriorityCardIds } from '@/lib/dashboardSectionOrder';
import type { TodayPlanPayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  plan: TodayPlanPayload | null | undefined;
  layout: ResolvedDashboardPhase14Layout;
  /** Priority slots to omit (e.g. follow-up rendered as its own section). */
  excludeCardIds?: ReadonlySet<string>;
};

function renderPriorityCard(id: string, plan: TodayPlanPayload) {
  switch (id) {
    case 'strategic_recommendation':
      return plan.strategicRecommendation ? (
        <StrategicRecommendationCard data={plan.strategicRecommendation} />
      ) : null;
    case 'opportunity_detection':
      return plan.opportunityDetection ? (
        <DashboardOpportunityDetectionCard data={plan.opportunityDetection} />
      ) : null;
    case 'follow_up_intelligence':
      return plan.followUpIntelligence || (plan.followUpJobs?.length ?? 0) > 0 ? (
        <DashboardFollowUpIntelligenceCard
          data={plan.followUpIntelligence}
          queueJobs={plan.followUpJobs}
          queueTotalCount={plan.followUpJobsTotalCount}
          followUpJobsViewAllHref={plan.followUpJobsViewAllHref}
        />
      ) : null;
    default:
      return null;
  }
}

export function DashboardPriorityIntelligenceZone({ plan, layout, excludeCardIds }: Props) {
  const slots = useMemo(
    () => selectActionablePriorityCardIds(plan, layout, 3, excludeCardIds ?? new Set()),
    [plan, layout, excludeCardIds],
  );

  if (!plan || slots.length === 0) return null;

  return (
    <section className="scroll-mt-4 space-y-6" aria-label="Priority intelligence">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
        Priority intelligence
      </p>
      <div className="grid grid-cols-1 items-start gap-6">
        {slots.map((id) => (
          <div
            key={id}
            className={cn(
              'min-w-0 self-start rounded-3xl shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)] ring-1 ring-white/[0.09]',
              'transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-[0_28px_72px_-26px_rgba(0,201,177,0.14)]',
            )}
          >
            <div className="[&>section]:rounded-3xl [&>section]:border-white/[0.06] [&>section]:shadow-none">
              {renderPriorityCard(id, plan)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
