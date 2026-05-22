import { describe, expect, it } from 'vitest';

import {
  computeOwnedClusters,
  dedupeByCluster,
  isHeroDominant,
  recommendedSectionsFallbackForMode,
  shouldRenderSection,
  sortByDisplayPriority,
} from '@/lib/dashboardOrchestration';
import type { DashboardSectionKey } from '@/lib/today-plan';

describe('dashboardOrchestration', () => {
  it('dedupes duplicate recommendation clusters', () => {
    const out = dedupeByCluster([
      { id: 'a', recommendationClusterId: 'followup:1', displayPriority: 5, priorityScore: 50 },
      { id: 'b', recommendationClusterId: 'followup:1', displayPriority: 1, priorityScore: 10 },
      { id: 'c', recommendationClusterId: 'interview:1', displayPriority: 3, priorityScore: 90 },
    ]);
    expect(out.map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('dedupes by workflowEntityKey even when cluster id differs', () => {
    const out = dedupeByCluster([
      { id: 'a', workflowEntityKey: 'application:1', recommendationClusterId: 'c1', displayPriority: 1 },
      { id: 'b', workflowEntityKey: 'application:1', recommendationClusterId: 'c2', displayPriority: 2 },
    ]);
    expect(out.map((x) => x.id)).toEqual(['a']);
  });

  it('reserves cluster after workflow-keyed row so a cluster-only duplicate drops', () => {
    const out = dedupeByCluster([
      { id: 'a', workflowEntityKey: 'application:1', recommendationClusterId: 'same', displayPriority: 1 },
      { id: 'b', recommendationClusterId: 'same', displayPriority: 2 },
    ]);
    expect(out.map((x) => x.id)).toEqual(['a']);
  });

  it('sorts by displayPriority before fallback score', () => {
    const out = sortByDisplayPriority([
      { id: 'a', displayPriority: 2, priorityScore: 1 },
      { id: 'b', displayPriority: 1, priorityScore: 1 },
      { id: 'c', priorityScore: 99 },
    ]);
    expect(out.map((x) => x.id)).toEqual(['b', 'a', 'c']);
  });

  it('computes hero-owned clusters for suppression', () => {
    const out = computeOwnedClusters(
      [
        { recommendationClusterId: 'cluster-1', surfaceOwnership: 'hero' },
        { recommendationClusterId: 'cluster-2', surfaceOwnership: 'nudge' },
      ],
      'hero',
    );
    expect(Array.from(out)).toEqual(['cluster-1']);
  });

  it('applies onboarding section simplification without recommendedSections', () => {
    const plan = { dashboardMode: 'onboarding' as const, recommendedSections: [] };
    expect(shouldRenderSection('today_plan', plan)).toBe(true);
    expect(shouldRenderSection('cv', plan)).toBe(true);
    expect(shouldRenderSection('onboarding', plan)).toBe(true);
    expect(shouldRenderSection('analyze', plan)).toBe(false);
    expect(shouldRenderSection('progress', plan)).toBe(false);
    expect(shouldRenderSection('revisit', plan)).toBe(false);
  });

  it('maps backend momentum key to progress gating', () => {
    const plan = {
      dashboardMode: 'active_search' as const,
      recommendedSections: ['hero', 'today_plan', 'analyze', 'momentum', 'revisit'] as DashboardSectionKey[],
    };
    expect(shouldRenderSection('progress', plan)).toBe(true);
    expect(shouldRenderSection('momentum', plan)).toBe(true);
  });

  it('does not treat empty recommendedSections as full dashboard — uses mode fallback', () => {
    const active = { dashboardMode: 'active_search' as const, recommendedSections: [] as DashboardSectionKey[] };
    expect(shouldRenderSection('progress', active)).toBe(true);
    expect(shouldRenderSection('analyze', active)).toBe(true);
    expect(shouldRenderSection('revisit', active)).toBe(true);
    expect(shouldRenderSection('nudges', active)).toBe(false);

    const low = { dashboardMode: 'low_activity' as const, recommendedSections: [] as DashboardSectionKey[] };
    expect(shouldRenderSection('today_plan', low)).toBe(true);
    expect(shouldRenderSection('progress', low)).toBe(true);
    expect(shouldRenderSection('analyze', low)).toBe(true);

    const recovery = { dashboardMode: 'recovery' as const, recommendedSections: [] as DashboardSectionKey[] };
    expect(shouldRenderSection('revisit', recovery)).toBe(true);
    expect(shouldRenderSection('analyze', recovery)).toBe(false);
  });

  it('exposes backend-aligned fallback allowlists', () => {
    expect(recommendedSectionsFallbackForMode('onboarding')).toEqual([
      'hero',
      'today_plan',
      'onboarding',
      'cv',
      'landscape',
      'summary_metrics',
    ]);
    expect(recommendedSectionsFallbackForMode('execution_focus')).toEqual([
      'hero',
      'today_plan',
      'analyze',
      'cv',
      'landscape',
      'summary_metrics',
    ]);
    expect(recommendedSectionsFallbackForMode(null)).toEqual([
      'hero',
      'today_plan',
      'analyze',
      'momentum',
      'revisit',
      'landscape',
      'summary_metrics',
      'cv',
    ]);
  });

  it('detects dominant hero action for continuation suppression', () => {
    expect(
      isHeroDominant({
        dashboardHeader: {
          actionContext: {
            type: 'stalled_application',
            companyName: null,
            roleTitle: null,
            daysSinceActivity: null,
            expectedOutcome: null,
            suggestedAction: null,
            estimatedMinutes: null,
            deepLink: null,
            canonicalJobId: null,
            applicationId: null,
            cvProfileId: null,
            recommendationId: null,
            executionMode: null,
            canonicalRoute: null,
            fallbackRoute: null,
            resolutionState: null,
            executionPayload: null,
            surfaceOwnership: 'hero',
            displayPriority: 1,
            recommendationClusterId: 'cluster-hero',
            suppressedBy: null,
            suppressionReason: null,
          },
        },
      } as never),
    ).toBe(true);
  });
});
