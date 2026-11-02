import { describe, expect, it } from 'vitest';

import type { JobHistoryItem } from '@/lib/api';
import type { TodayPlanPayload } from '@/lib/today-plan';

import {
  buildRecap,
  buildRecentJobs,
  buildSetupSteps,
  buildTodayActions,
  chooseNextStep,
  countPipeline,
  doneUntil,
  greetingFor,
  hiddenTaskIds,
  notTodayUntil,
  pickUpcomingInterview,
  TIDY_SAVED_TASK_ID,
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
    const steps = buildSetupSteps({
      hasCv: true,
      jobsChecked: 0,
      tracked: 2,
      tourDone: false,
    });
    expect(steps.map((s) => s.done)).toEqual([true, true, false, true, false]);
    expect(steps[4]).toEqual(
      expect.objectContaining({ id: 'tour', action: 'start-tour' }),
    );
  });
});

describe("Today: the server's priority list", () => {
  it('lists its tasks, opening apply / tailor tasks on the job itself', () => {
    const actions = buildTodayActions(
      plan({
        unifiedPriorities: {
          summary: {},
          items: [
            {
              id: 'prio-apply-job-1',
              title: 'Apply to GitLab',
              subtitle: 'Senior Frontend Engineer · your tailored CV is ready',
              suppressedBy: null,
              executionContext: {
                deepLink: '/dashboard/job-hub?jobAnalysisId=job-1',
              },
            },
            {
              id: 'prio-tailor-job-2',
              title: 'Tailor your CV for Stripe',
              subtitle: 'Frontend Engineer · 72% match',
              suppressedBy: null,
            },
            {
              id: 'prio-cvnudge-1',
              title: 'CV clinic',
              subtitle: 'Lacks specific achievements',
              suppressedBy: null,
              executionContext: { deepLink: '/dashboard/cv?profileId=cv-1' },
              compactDisplay: { actionLabel: 'Open CV clinic' },
            },
            { id: 'prio-old', title: 'Hidden duplicate', suppressedBy: 'hero' },
          ],
        },
      } as unknown as Partial<TodayPlanPayload>),
      { limit: 4 },
    );
    expect(actions.map((a) => [a.title, a.href, a.ctaLabel])).toEqual([
      ['Apply to GitLab', '/dashboard/jobs/analyze?jobId=job-1', 'Apply now'],
      [
        'Tailor your CV for Stripe',
        '/dashboard/jobs/analyze?jobId=job-2',
        'Tailor CV',
      ],
      ['CV clinic', '/dashboard/cv?profileId=cv-1', 'Open CV clinic'],
    ]);
  });
});

describe('Today: hidden tasks and old saved jobs', () => {
  const stale = (id: string, company: string) => ({
    id,
    headline: 'Saved for 40 days',
    supporting: null,
    ctaHref: `/dashboard/jobs?bookmarkId=${id}`,
    ctaLabel: 'Open in Job Hub',
    reason: 'bookmark_stale',
    companyName: company,
  });

  it('leaves out tasks marked Done or Not today', () => {
    const actions = buildTodayActions(
      plan({
        followUpJobs: [
          { id: 'a', headline: 'Follow up with Hubtel', ctaHref: '/f/a' },
          { id: 'b', headline: 'Follow up with MTN', ctaHref: '/f/b' },
        ] as TodayPlanPayload['followUpJobs'],
      }),
      { hidden: new Set(['follow-a']) },
    );
    expect(actions.map((a) => a.id)).toEqual(['follow-b']);
  });

  it('turns several old saved jobs into one tidy-up task, after the real ones', () => {
    const actions = buildTodayActions(
      plan({
        followUpJobs: [
          stale('s1', 'Hubtel'),
          { id: 'a', headline: 'Follow up with MTN', ctaHref: '/f/a' },
          stale('s2', 'Paystack'),
          stale('s3', 'Kudi'),
        ] as TodayPlanPayload['followUpJobs'],
      }),
    );
    expect(actions.map((a) => a.title)).toEqual([
      'Follow up with MTN',
      'Tidy up 3 old saved jobs',
    ]);
    expect(actions[1]).toEqual(
      expect.objectContaining({
        id: TIDY_SAVED_TASK_ID,
        href: '/dashboard/jobs?stage=saved',
      }),
    );
  });

  it('names the company on a single old saved job', () => {
    const [only] = buildTodayActions(
      plan({
        followUpJobs: [
          stale('s1', 'Hubtel'),
        ] as TodayPlanPayload['followUpJobs'],
      }),
    );
    expect(only?.title).toBe('Hubtel: saved for 40 days');
  });

  it('reads still-hidden ids and works out when they come back', () => {
    const now = new Date(2026, 10, 1, 15, 30);
    expect([
      ...hiddenTaskIds(
        {
          'follow-a': new Date(2026, 10, 2).toISOString(),
          'follow-b': new Date(2026, 10, 1, 9).toISOString(),
          junk: 4,
        },
        now,
      ),
    ]).toEqual(['follow-a']);
    expect(notTodayUntil(now)).toEqual(new Date(2026, 10, 2, 0, 0, 0, 0));
    expect(doneUntil(now).getTime() - now.getTime()).toBe(30 * 86_400_000);
  });
});

describe('interview first', () => {
  it('leads with an interview in the next two weeks', () => {
    const interviewPlan = plan({
      upcomingInterviews: [
        { id: 'far', daysUntilInterview: 20, company: 'MTN' },
        {
          id: 'soon',
          daysUntilInterview: 2,
          company: 'Hubtel',
          jobTitle: 'Frontend Engineer',
          ctaHref: '/prep/soon',
          ctaLabel: 'Prepare',
        },
      ] as TodayPlanPayload['upcomingInterviews'],
    });
    const interview = pickUpcomingInterview(interviewPlan);
    expect(interview?.id).toBe('soon');
    const step = chooseNextStep({
      hasCv: true,
      jobsChecked: 3,
      today: [
        {
          id: 'follow-1',
          title: 'Follow up',
          detail: null,
          href: '/x',
          ctaLabel: 'Go',
        },
      ],
      plan: interviewPlan,
      interview,
    });
    expect(step).toEqual(
      expect.objectContaining({
        id: 'interview-soon',
        title: 'Get ready for your Hubtel interview',
        href: '/prep/soon',
      }),
    );
    expect(step.detail).toContain('Frontend Engineer interview is in 2 days');
  });
});

describe('buildRecap', () => {
  const base = {
    lastSeenAt: '2026-10-30T10:00:00.000Z',
    newJobsCount: 0,
    newHighMatchCount: 0,
    newStalledCount: 0,
    statusChangedCount: 0,
    newRecommendationsCount: 0,
  };
  const week = {
    actionsCompletedToday: 0,
    actionsCompletedWeek: 0,
    applicationsSubmittedWeek: 0,
    followUpsSentWeek: 0,
    pipelineAdvancedWeek: 0,
  };

  it('says what changed since the last visit', () => {
    expect(
      buildRecap(
        plan({
          sinceLastVisit: { ...base, newJobsCount: 2, statusChangedCount: 1 },
          progress: week,
        }),
      ),
    ).toBe('Since your last visit: 2 jobs saved · 1 application updated.');
  });

  it("falls back to this week's progress, then to nothing", () => {
    expect(
      buildRecap(
        plan({
          sinceLastVisit: base,
          progress: { ...week, applicationsSubmittedWeek: 1 },
        }),
      ),
    ).toBe('This week: 1 application sent.');
    expect(
      buildRecap(plan({ sinceLastVisit: base, progress: week })),
    ).toBeNull();
  });
});

describe('buildRecentJobs', () => {
  const job = (over: Partial<JobHistoryItem>) =>
    ({
      id: 'j',
      jobTitle: 'Engineer',
      company: 'Hubtel',
      createdAt: '2026-10-01T00:00:00.000Z',
      isTailored: false,
      companyLogoUrl: null,
      ...over,
    }) as JobHistoryItem;

  it('shows the last three jobs with the action that moves each forward', () => {
    const recent = buildRecentJobs([
      job({ id: 'old', createdAt: '2026-09-01T00:00:00.000Z' }),
      job({ id: 'saved', lastActivityAt: '2026-10-30T00:00:00.000Z' }),
      job({
        id: 'tailored',
        isTailored: true,
        applyUrl: 'https://jobs.example.com/1',
        lastActivityAt: '2026-10-29T00:00:00.000Z',
      }),
      job({
        id: 'applied',
        pipelineStatus: 'applied',
        lastActivityAt: '2026-10-28T00:00:00.000Z',
      }),
    ]);
    expect(recent.map((r) => [r.id, r.status, r.action.label])).toEqual([
      ['saved', 'Saved', 'Tailor CV'],
      ['tailored', 'Tailored', 'Apply'],
      ['applied', 'Applied', 'Open'],
    ]);
    expect(recent[0]?.action.href).toBe(
      '/dashboard/jobs?jobAnalysisId=saved&tab=resume',
    );
    expect(recent[1]?.action.external).toBe(true);
  });
});

describe('greetingFor', () => {
  it('follows the time of day', () => {
    expect(greetingFor(new Date(2026, 0, 1, 9))).toBe('Good morning');
    expect(greetingFor(new Date(2026, 0, 1, 14))).toBe('Good afternoon');
    expect(greetingFor(new Date(2026, 0, 1, 20))).toBe('Good evening');
  });
});
