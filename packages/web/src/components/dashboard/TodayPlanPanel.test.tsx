import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TodayPlanPanel } from '@/components/dashboard/TodayPlanPanel';
import { normalizeTodayPlan } from '@/lib/today-plan';

const trackProductEvent = vi.fn();
vi.mock('@/lib/productAnalytics', () => ({
  trackProductEvent: (...args: unknown[]) => trackProductEvent(...args),
}));
vi.mock('@/lib/actionFunnel', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/hooks/useApplications', () => ({
  useApplications: () => ({ data: undefined }),
}));

vi.mock('@/hooks/useJobHistory', () => ({
  useJobHistory: () => ({ data: undefined }),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    api: {
      ...actual.api,
      dashboard: {
        ...actual.api.dashboard,
        prefetchNextActions: vi.fn().mockResolvedValue({}),
      },
      growth: {
        ...actual.api.growth,
        trackEvent: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

describe('TodayPlanPanel', () => {
  it('shows loading skeleton while today plan is fetching', () => {
    const { container } = render(
      <TodayPlanPanel
        data={undefined}
        isLoading={true}
        isFetching={true}
        error={undefined}
        onRefresh={vi.fn()}
        defaultCvProfileId={null}
      />,
    );

    expect(container.querySelector('[class*="shimmer"]')).toBeInTheDocument();
  });

  it('shows error UI when the today-plan query fails', () => {
    render(
      <TodayPlanPanel
        data={undefined}
        isLoading={false}
        isFetching={false}
        error={new Error('network')}
        onRefresh={vi.fn()}
        defaultCvProfileId={null}
      />,
    );

    expect(screen.getByText(/Could not load Today's Plan/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  }, 10_000);

  it('opens inline execution modal for follow-up cards', () => {
    const data = normalizeTodayPlan({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        digestVersion: '1',
        dashboardHeader: {},
        unifiedPriorities: {
          items: [
            {
              id: 'p1',
              kind: 'follow_up',
              title: 'Follow up with Acme',
              urgencyBucket: 'now',
              priorityScore: 80,
              reasonCodes: [],
              cta: { label: 'Send follow-up', action: { type: 'OPEN_ANALYZE', jobAnalysisId: 'ja1' } },
              executionContext: {
                nextImmediateAction: 'Send one short note',
                executionMode: 'inline_modal',
                canExecuteInline: true,
                deepLink: '/dashboard/jobs/analyze?jobAnalysisId=ja1',
              },
              followUpContext: {
                suggested: true,
                daysSinceLastActivity: 5,
                confidence: 0.8,
                recommendedChannel: 'email',
                draftMessage: 'Hi team, following up on my application.',
              },
              ids: { jobAnalysisId: 'ja1' },
            },
          ],
          summary: {
            highPriorityCount: 1,
            followUpDueCount: 1,
            newOpportunitiesCount: 0,
            currentRecommendationsCount: 1,
            newRecommendationsCount: 1,
            carryOverRecommendationsCount: 0,
            localRecommendationsCount: 1,
            remoteFallbackRecommendationsCount: 0,
            dedupeDroppedCount: 0,
            suppressionFamilyCount: 1,
          },
        },
        sinceLastVisit: { newJobsCount: 0, newHighMatchCount: 0, newStalledCount: 0, statusChangedCount: 0, newRecommendationsCount: 1 },
        progress: { actionsCompletedWeek: 1, pipelineAdvancedWeek: 0, actionsCompletedToday: 0 },
        dailyMission: { isMeaningful: false, recommendedPriorityIds: [], targetActionsToday: 1, actionsRemainingToday: 1 },
        continuationState: { routeValidated: false, routeValidationReason: 'missing_target' },
        reentrySummary: { newStrongMatchesCount: 0, nearCompletionCount: 0 },
      },
    });
    render(
      <TodayPlanPanel
        data={data}
        isLoading={false}
        isFetching={false}
        error={undefined}
        onRefresh={vi.fn()}
        defaultCvProfileId={null}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: /send one short note/i }));
    expect(screen.getByText(/Assisted execution/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument();
    expect(trackProductEvent).toHaveBeenCalledWith(
      'modal_opened',
      expect.objectContaining({ recommendationId: 'p1' }),
    );
  });

  it('prefers deepLink for degraded references', () => {
    const data = normalizeTodayPlan({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        digestVersion: '1',
        dashboardHeader: {},
        unifiedPriorities: {
          items: [
            {
              id: 'p2',
              kind: 'follow_up',
              title: 'Follow up safely',
              urgencyBucket: 'now',
              priorityScore: 70,
              reasonCodes: [],
              suppressionReason: 'stale_execution_reference',
              cta: { label: 'Continue', action: { type: 'OPEN_JOB_HUB', jobAnalysisId: 'ja-missing' } },
              executionContext: {
                executionMode: 'continue_flow',
                canExecuteInline: false,
                deepLink: '/dashboard/jobs?view=active&recovered=1',
              },
              ids: { jobAnalysisId: 'ja-missing' },
            },
          ],
          summary: {
            highPriorityCount: 1,
            followUpDueCount: 1,
            newOpportunitiesCount: 0,
            currentRecommendationsCount: 1,
            newRecommendationsCount: 1,
            carryOverRecommendationsCount: 0,
            localRecommendationsCount: 1,
            remoteFallbackRecommendationsCount: 0,
            dedupeDroppedCount: 0,
            suppressionFamilyCount: 1,
          },
        },
        sinceLastVisit: { newJobsCount: 0, newHighMatchCount: 0, newStalledCount: 0, statusChangedCount: 0, newRecommendationsCount: 1 },
        progress: { actionsCompletedWeek: 0, pipelineAdvancedWeek: 0, actionsCompletedToday: 0 },
        dailyMission: { isMeaningful: false, recommendedPriorityIds: [], targetActionsToday: 1, actionsRemainingToday: 1 },
        continuationState: {},
        reentrySummary: { newStrongMatchesCount: 0, nearCompletionCount: 0 },
      },
    });
    render(
      <TodayPlanPanel
        data={data}
        isLoading={false}
        isFetching={false}
        error={undefined}
        onRefresh={vi.fn()}
        defaultCvProfileId={null}
      />,
    );
    const link = screen.getByRole('link', { name: /continue/i });
    expect(link).toHaveAttribute('href', '/dashboard/jobs?view=active&recovered=1');
    expect(screen.getByText(/Context refreshed/i)).toBeInTheDocument();
  });

  it('renders duplicate clusters only once and can suppress continuation banner', () => {
    const data = normalizeTodayPlan({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        digestVersion: '1',
        dashboardHeader: {},
        unifiedPriorities: {
          items: [
            {
              id: 'p-top',
              kind: 'follow_up',
              title: 'Hero-owned follow-up duplicate',
              urgencyBucket: 'now',
              priorityScore: 90,
              displayPriority: 2,
              recommendationClusterId: 'cluster-hero',
              reasonCodes: [],
              cta: { label: 'Continue', action: { type: 'OPEN_JOB_HUB', applicationId: 'app-1' } },
              ids: { applicationId: 'app-1' },
            },
            {
              id: 'p-other',
              kind: 'follow_up',
              title: 'Keep thread warm',
              urgencyBucket: 'now',
              priorityScore: 80,
              displayPriority: 1,
              recommendationClusterId: 'cluster-other',
              reasonCodes: [],
              cta: { label: 'Continue', action: { type: 'OPEN_JOB_HUB', applicationId: 'app-2' } },
              ids: { applicationId: 'app-2' },
            },
            {
              id: 'p-dupe',
              kind: 'follow_up',
              title: 'Keep thread warm duplicate',
              urgencyBucket: 'now',
              priorityScore: 70,
              displayPriority: 3,
              recommendationClusterId: 'cluster-other',
              reasonCodes: [],
              cta: { label: 'Continue', action: { type: 'OPEN_JOB_HUB', applicationId: 'app-3' } },
              ids: { applicationId: 'app-3' },
            },
          ],
          summary: {
            highPriorityCount: 2,
            followUpDueCount: 2,
            newOpportunitiesCount: 0,
            currentRecommendationsCount: 3,
            newRecommendationsCount: 3,
            carryOverRecommendationsCount: 0,
            localRecommendationsCount: 3,
            remoteFallbackRecommendationsCount: 0,
            dedupeDroppedCount: 0,
            suppressionFamilyCount: 2,
          },
        },
        sinceLastVisit: { newJobsCount: 0, newHighMatchCount: 0, newStalledCount: 0, statusChangedCount: 0, newRecommendationsCount: 2 },
        progress: { actionsCompletedWeek: 0, pipelineAdvancedWeek: 0, actionsCompletedToday: 0 },
        dailyMission: { isMeaningful: false, recommendedPriorityIds: [], targetActionsToday: 1, actionsRemainingToday: 1 },
        continuationState: { message: 'Continue where you left off' },
        reentrySummary: { newStrongMatchesCount: 0, nearCompletionCount: 0 },
      },
    });
    render(
      <TodayPlanPanel
        data={data}
        isLoading={false}
        isFetching={false}
        error={undefined}
        onRefresh={vi.fn()}
        defaultCvProfileId={null}
        heroClusterId="cluster-hero"
        suppressContinuation={true}
      />,
    );
    expect(screen.queryByText(/Hero-owned follow-up duplicate/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Keep thread warm/i)).toBeInTheDocument();
    expect(screen.queryByText(/Keep thread warm duplicate/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Resume where you left off/i)).not.toBeInTheDocument();
  });

  it('shows neutral copy when interview context is missing and keeps backend fallback route', () => {
    const data = normalizeTodayPlan({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        digestVersion: '1',
        dashboardHeader: {},
        unifiedPriorities: {
          items: [
            {
              id: 'p-missing-interview',
              kind: 'follow_up',
              title: 'Review interview notes and confirm next interview action',
              urgencyBucket: 'now',
              priorityScore: 75,
              reasonCodes: [],
              suppressionReason: 'missing_interview_context',
              cta: { label: 'Continue', action: { type: 'OPEN_JOB_HUB', applicationId: 'app-22' } },
              executionContext: {
                executionMode: 'continue_flow',
                canExecuteInline: false,
                deepLink: '/dashboard/jobs?applicationId=app-22&focus=followup',
              },
              ids: { applicationId: 'app-22' },
            },
          ],
          summary: {
            highPriorityCount: 1,
            followUpDueCount: 1,
            newOpportunitiesCount: 0,
            currentRecommendationsCount: 1,
            newRecommendationsCount: 1,
            carryOverRecommendationsCount: 0,
            localRecommendationsCount: 1,
            remoteFallbackRecommendationsCount: 0,
            dedupeDroppedCount: 0,
            suppressionFamilyCount: 1,
          },
        },
        sinceLastVisit: { newJobsCount: 0, newHighMatchCount: 0, newStalledCount: 0, statusChangedCount: 0, newRecommendationsCount: 1 },
        progress: { actionsCompletedWeek: 0, pipelineAdvancedWeek: 0, actionsCompletedToday: 0 },
        dailyMission: { isMeaningful: false, recommendedPriorityIds: [], targetActionsToday: 1, actionsRemainingToday: 1 },
        continuationState: {},
        reentrySummary: { newStrongMatchesCount: 0, nearCompletionCount: 0 },
      },
    });
    render(
      <TodayPlanPanel
        data={data}
        isLoading={false}
        isFetching={false}
        error={undefined}
        onRefresh={vi.fn()}
        defaultCvProfileId={null}
      />,
    );
    expect(
      screen.getByText(/Interview prep is not available yet; here is your next valid step\./i),
    ).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /continue/i });
    expect(link).toHaveAttribute('href', '/dashboard/jobs?applicationId=app-22&focus=followup');
  });
});
