import { describe, expect, it } from 'vitest';

import {
  enrichGuidancePayload,
  hubPipelineStepIdToHubStage,
  isGuidanceTaskUserToggleable,
  optimisticPipelineStepper,
  parseJobHubDetailTabFromHref,
  parseJobHubGuidance,
  parseJobHubPipelineStepper,
  resolveGuidanceTaskActions,
  resolveTrackedJobMatchScore,
} from '@/lib/jobHubGuidance';

describe('jobHubGuidance parsers', () => {
  it('parses pipeline stepper', () => {
    const stepper = parseJobHubPipelineStepper({
      currentStepId: 'applied',
      statusHint: 'Applied 12 days ago',
      steps: [
        { id: 'bookmarked', label: 'Saved', state: 'complete', order: 0, clickable: false },
        { id: 'applied', label: 'Applied', state: 'current', order: 2, clickable: false },
      ],
    });
    expect(stepper?.currentStepId).toBe('applied');
    expect(stepper?.steps).toHaveLength(2);
    expect(stepper?.statusHint).toBe('Applied 12 days ago');
  });

  it('parses guidance with tasks', () => {
    const guidance = parseJobHubGuidance({
      phaseId: 'applied',
      phaseLabel: 'Applied',
      title: 'Guidance',
      headline: 'Applied steps',
      percentComplete: 25,
      tasks: [
        {
          id: 'follow_up_1',
          label: 'Send 1st follow-up',
          state: 'pending',
          autoCompleted: false,
          scheduledLabel: 'Send 1st follow-up on 8 Jun 2026',
        },
      ],
    });
    expect(guidance?.phaseId).toBe('applied');
    expect(guidance?.tasks[0]?.scheduledLabel).toContain('follow-up');
  });

  it('maps step ids to hub stages', () => {
    expect(hubPipelineStepIdToHubStage('preparing', { hasAnalysis: true })).toBe('analyzed');
    expect(hubPipelineStepIdToHubStage('negotiating', { hasAnalysis: false })).toBe('negotiating');
  });

  it('resolves match score from job detail fallback', () => {
    expect(
      resolveTrackedJobMatchScore({ matchScore: null, jobAnalysisId: 'j1' }, 92),
    ).toBe(92);
    expect(resolveTrackedJobMatchScore({ matchScore: 88, jobAnalysisId: 'j1' }, null)).toBe(88);
  });

  it('optimistically advances stepper', () => {
    const base = parseJobHubPipelineStepper({
      currentStepId: 'preparing',
      steps: [
        { id: 'bookmarked', label: 'Saved', state: 'complete', order: 0, clickable: false },
        { id: 'preparing', label: 'Prep', state: 'current', order: 1, clickable: false },
        { id: 'applied', label: 'Applied', state: 'upcoming', order: 2, clickable: true },
      ],
    })!;
    const next = optimisticPipelineStepper(base, 'applied');
    expect(next.currentStepId).toBe('applied');
    expect(next.steps.find((s) => s.id === 'applied')?.state).toBe('current');
  });

  it('parses job hub tab from deep links', () => {
    expect(
      parseJobHubDetailTabFromHref(
        '/dashboard/jobs?applicationId=x&tab=email-templates&template=follow-up-no-response',
      ),
    ).toBe('email');
    expect(parseJobHubDetailTabFromHref('/dashboard/jobs?jobId=y&tab=description')).toBe(
      'description',
    );
    expect(parseJobHubDetailTabFromHref('/dashboard/jobs?jobId=y&tab=cover-letter')).toBe('cover');
  });

  it('locks verified guidance tasks from user toggle', () => {
    expect(
      isGuidanceTaskUserToggleable({
        id: 'tailor_cv',
        label: 'Tailor CV',
        state: 'completed',
        autoCompleted: true,
      }),
    ).toBe(false);
    expect(
      isGuidanceTaskUserToggleable({
        id: 'identify_contacts',
        label: 'Find recruiter',
        state: 'pending',
        autoCompleted: false,
      }),
    ).toBe(true);
  });

  it('remaps draft cover letter CTA to cover tab', () => {
    const resolved = resolveGuidanceTaskActions(
      {
        id: 'draft_cover_letter',
        label: 'Draft cover letter',
        state: 'pending',
        autoCompleted: false,
        ctaLabel: 'Draft cover letter',
        ctaHref: '/dashboard/jobs?applicationId=a&tab=email',
      },
      { applicationId: 'a' },
    );
    expect(resolved.ctaHref).toContain('tab=cover');
    expect(resolved.ctaLabel).toBe('Draft cover letter');
  });

  it('remaps identify contacts to hiring manager template', () => {
    const resolved = resolveGuidanceTaskActions(
      {
        id: 'identify_contacts',
        label: 'Find recruiter',
        state: 'pending',
        autoCompleted: false,
      },
      { applicationId: 'a' },
    );
    expect(resolved.ctaHref).toContain('template=hiring_manager_outreach');
  });

  it('remaps archive if silent to in-panel archive action', () => {
    const resolved = resolveGuidanceTaskActions(
      {
        id: 'archive_if_silent',
        label: 'Archive if no reply after 3 weeks',
        state: 'pending',
        autoCompleted: false,
        ctaLabel: 'Send follow-up',
        ctaHref: '/dashboard/jobs?applicationId=a&tab=email',
      },
      { applicationId: 'a' },
    );
    expect(resolved.ctaLabel).toBe('Archive this job');
    expect(resolved.ctaHref).toBe('#applymate:hub-archive');
    expect(resolved.secondaryCtaHref).toBeNull();
  });

  it('enriches follow-up supporting copy when backend omits it', () => {
    const enriched = enrichGuidancePayload(
      parseJobHubGuidance({
        phaseId: 'applied',
        phaseLabel: 'Applied',
        title: 'Guidance',
        headline: 'Applied steps',
        percentComplete: 40,
        tasks: [
          {
            id: 'follow_up_2',
            label: 'Send 2nd follow-up',
            state: 'pending',
            autoCompleted: false,
          },
        ],
      })!,
      { applicationId: 'app-1' },
    );
    expect(enriched.tasks[0]?.supporting).toContain('second note');
  });
});
