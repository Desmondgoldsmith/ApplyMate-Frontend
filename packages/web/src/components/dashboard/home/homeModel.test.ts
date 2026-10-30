import { describe, expect, it } from 'vitest';

import type { JobHistoryItem } from '@/lib/api';
import type { TodayPlanPayload } from '@/lib/today-plan';

import {
  buildSetupSteps,
  buildTodayActions,
  chooseNextStep,
  countPipeline,
  greetingFor,
} from './homeModel';

const plan = (over: Partial<TodayPlanPayload>) => over as TodayPlanPayload;

describe('chooseNextStep', () => {
  it('asks a new user to add their CV first', () => {
    expect(
      chooseNextStep({ hasCv: false, jobsChecked: 0, today: [], plan: null })
        .id,
    ).toBe('add-cv');
  });

  it('then asks them to check their fit for a first job', () => {
    const step = chooseNextStep({
      hasCv: true,
      jobsChecked: 0,
      today: [],
      plan: null,
    });
    expect(step.id).toBe('first-check');
    expect(step.secondary?.href).toBe('/dashboard/job-board');
  });

  it('prefers an urgent to-do once the user is set up', () => {
    const step = chooseNextStep({
      hasCv: true,
      jobsChecked: 3,
      today: [
        {
          id: 'follow-1',
          title: 'Follow up with Hubtel',
          detail: null,
          href: '/x',
          ctaLabel: 'Write email',
        },
      ],
      plan: null,
    });
    expect(step.title).toBe('Follow up with Hubtel');
  });

  it('falls back to the backend recommended move, then to finding jobs', () => {
    const withMove = chooseNextStep({
      hasCv: true,
      jobsChecked: 3,
      today: [],
      plan: plan({
        recommendedMove: {
          source: 'nextStep',
          headline: 'Tailor your CV for Product Designer roles',
          supporting: null,
          confidence: null,
          priority: null,
          category: null,
          ctaLabel: 'Tailor',
          ctaHref: '/dashboard/cv',
        },
      }),
    });
    expect(withMove.id).toBe('recommended');
    expect(
      chooseNextStep({ hasCv: true, jobsChecked: 3, today: [], plan: null }).id,
    ).toBe('find-roles');
  });
});

describe('buildTodayActions', () => {
  it('lists follow-ups first, skips rows without a link and caps the list', () => {
    const actions = buildTodayActions(
      plan({
        followUpJobs: [
          {
            id: 'a',
            headline: 'Follow up with Hubtel',
            supporting: '5 days since you applied',
            ctaHref: '/f/a',
            ctaLabel: 'Write email',
          },
          { id: 'b', headline: 'No link here', ctaHref: null },
        ] as TodayPlanPayload['followUpJobs'],
        needsAttention: [
          {
            id: 'n1',
            title: 'Interview tomorrow',
            reasonCodes: [],
            cta: { label: 'Prepare', href: '/i', action: {} },
          },
        ] as TodayPlanPayload['needsAttention'],
        todaysFocus: [
          {
            id: 't1',
            title: 'Save 2 jobs',
            reasonCodes: [],
            cta: { label: 'Find', href: '/j', action: {} },
          },
          {
            id: 't2',
            title: 'Extra',
            reasonCodes: [],
            cta: { label: 'Go', href: '/k', action: {} },
          },
        ] as TodayPlanPayload['todaysFocus'],
      }),
    );
    expect(actions.map((a) => a.title)).toEqual([
      'Follow up with Hubtel',
      'Interview tomorrow',
      'Save 2 jobs',
    ]);
  });

  it('returns nothing without a plan', () => {
    expect(buildTodayActions(null)).toEqual([]);
  });
});

describe('countPipeline and setup steps', () => {
  it('groups stages the way people talk about them', () => {
    const items = [
      'saved',
      'applied',
      'applied',
      'interviewing',
      'offered',
      'accepted',
      'rejected',
    ].map(
      (pipelineStatus, i) =>
        ({ id: String(i), pipelineStatus }) as JobHistoryItem,
    );
    expect(countPipeline(items)).toEqual({
      saved: 1,
      applied: 2,
      interviewing: 1,
      offers: 2,
    });
  });

  it('marks setup steps done from real progress', () => {
    const steps = buildSetupSteps({ hasCv: true, jobsChecked: 0, tracked: 2 });
    expect(steps.map((s) => s.done)).toEqual([true, true, false, true]);
  });
});

describe('greetingFor', () => {
  it('follows the time of day', () => {
    expect(greetingFor(new Date(2026, 0, 1, 9))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 0, 1, 20))).toBe('Good evening');
  });
});
