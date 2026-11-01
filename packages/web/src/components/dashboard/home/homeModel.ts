import type {
  CvProfileSummary,
  HubPipelineStage,
  JobHistoryItem,
} from '@/lib/api';
import type { TodayPlanPayload, UpcomingInterviewItem } from '@/lib/today-plan';

export type HomeAction = {
  id: string;
  title: string;
  detail: string | null;
  href: string;
  ctaLabel: string;
};

export type NextStep = HomeAction & {
  /** Optional second, quieter option. */
  secondary?: { label: string; href: string };
};

export type SetupStep = {
  id: 'account' | 'cv' | 'check' | 'track' | 'tour';
  label: string;
  done: boolean;
  href: string;
  /** Steps that start something on the page instead of navigating. */
  action?: 'start-tour';
};

export type RecentJobStatus =
  | 'Saved'
  | 'Tailored'
  | 'Applied'
  | 'Interviewing'
  | 'Offer'
  | 'Closed';

export type RecentJob = {
  id: string;
  title: string;
  company: string;
  logoUrl: string | null;
  status: RecentJobStatus;
  /** ISO time of the last activity on this job. */
  at: string;
  action: { label: string; href: string; external?: boolean };
};

export type PipelineCounts = {
  saved: number;
  applied: number;
  interviewing: number;
  offers: number;
};

export const ROUTES = {
  cv: '/dashboard/cv',
  checkJob: '/dashboard/jobs/analyze?clean=1',
  findJobs: '/dashboard/job-board',
  applications: '/dashboard/jobs',
  interview: '/dashboard/interview',
} as const;

/** Job Hub filtered to one group of the Home application numbers. */
export function applicationsHref(
  stage: 'saved' | 'applied' | 'interviewing' | 'offers',
): string {
  return `${ROUTES.applications}?stage=${stage}`;
}

const NOT_TODAY_FALLBACK_MS = 12 * 60 * 60_000;
const DONE_HIDE_DAYS = 30;

/** "Not today": back at the next local midnight. */
export function notTodayUntil(now: Date): Date {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() > now.getTime()
    ? midnight
    : new Date(now.getTime() + NOT_TODAY_FALLBACK_MS);
}

/** "Done": the planner does not know the user did it, so keep it away for a month. */
export function doneUntil(now: Date): Date {
  return new Date(now.getTime() + DONE_HIDE_DAYS * 24 * 60 * 60_000);
}

/** Task ids from `uiPrefs.dashboardHiddenTasks` that are still hidden at `now`. */
export function hiddenTaskIds(raw: unknown, now: Date): Set<string> {
  const out = new Set<string>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, until] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof until === 'string' && Date.parse(until) > now.getTime()) {
      out.add(id);
    }
  }
  return out;
}

export function pickDefaultProfile(
  rows: CvProfileSummary[],
): CvProfileSummary | null {
  return rows.find((p) => p.isDefault) ?? rows[0] ?? null;
}

export function countPipeline(items: JobHistoryItem[]): PipelineCounts {
  const counts: PipelineCounts = {
    saved: 0,
    applied: 0,
    interviewing: 0,
    offers: 0,
  };
  for (const item of items) {
    const stage: HubPipelineStage | undefined = item.pipelineStatus;
    if (stage === 'saved') counts.saved += 1;
    else if (stage === 'applied') counts.applied += 1;
    else if (stage === 'interviewing') counts.interviewing += 1;
    else if (
      stage === 'offered' ||
      stage === 'negotiating' ||
      stage === 'accepted'
    )
      counts.offers += 1;
  }
  return counts;
}

export function trackedCount(counts: PipelineCounts): number {
  return counts.saved + counts.applied + counts.interviewing + counts.offers;
}

export function buildSetupSteps(input: {
  hasCv: boolean;
  jobsChecked: number;
  tracked: number;
  tourDone: boolean;
}): SetupStep[] {
  return [
    {
      id: 'account',
      label: 'Create your account',
      done: true,
      href: '/dashboard',
    },
    { id: 'cv', label: 'Add your CV', done: input.hasCv, href: ROUTES.cv },
    {
      id: 'check',
      label: 'Check your fit for a job',
      done: input.jobsChecked > 0,
      href: ROUTES.checkJob,
    },
    {
      id: 'track',
      label: 'Save a job to track it',
      done: input.tracked > 0,
      href: ROUTES.findJobs,
    },
    {
      id: 'tour',
      label: 'Take the 1-minute tour',
      done: input.tourDone,
      href: '/dashboard',
      action: 'start-tour',
    },
  ];
}

function clean(value: string | null | undefined): string | null {
  const v = value?.replace(/\s+/g, ' ').trim();
  return v ? v : null;
}

export const TIDY_SAVED_TASK_ID = 'tidy-old-saved';

/**
 * Up to `limit` things worth doing today: follow-ups first, then urgent and focus items. Tasks the
 * user marked Done or Not today are left out, and old saved jobs collapse into one tidy-up task.
 */
export function buildTodayActions(
  plan: TodayPlanPayload | null | undefined,
  opts: { limit?: number; hidden?: ReadonlySet<string> } = {},
): HomeAction[] {
  if (!plan) return [];
  const limit = opts.limit ?? 3;
  const hidden = opts.hidden ?? new Set<string>();
  const out: HomeAction[] = [];
  const seen = new Set<string>();
  const push = (a: HomeAction | null) => {
    if (!a || out.length >= limit || hidden.has(a.id)) return;
    const key = `${a.href}|${a.title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(a);
  };

  const followUps = plan.followUpJobs ?? [];
  const stale = followUps.filter(
    (row) => row.reason === 'bookmark_stale' || row.reason === 'analysis_stale',
  );
  const groupStale = stale.length >= 2;
  for (const row of followUps) {
    if (groupStale && stale.includes(row)) continue;
    const title = clean(row.headline);
    const href = clean(row.ctaHref);
    if (!title || !href) continue;
    const company = clean(row.companyName);
    push({
      id: `follow-${row.id}`,
      // "Saved for 40 days" alone does not say which job; name it.
      title:
        company && /^saved for \d+ days?$/i.test(title)
          ? `${company}: ${title.toLowerCase()}`
          : title,
      detail: clean(row.supporting),
      href,
      ctaLabel: clean(row.ctaLabel) ?? 'Open',
    });
  }

  for (const item of [
    ...(plan.needsAttention ?? []),
    ...(plan.todaysFocus ?? []),
  ]) {
    const title = clean(item.title);
    const href = clean(item.cta?.href);
    if (!title || !href) continue;
    push({
      id: `plan-${item.id}`,
      title,
      detail: clean(item.subtitle),
      href,
      ctaLabel: clean(item.cta?.label) ?? 'Open',
    });
  }

  if (groupStale) {
    push({
      id: TIDY_SAVED_TASK_ID,
      title: `Tidy up ${stale.length} old saved jobs`,
      detail:
        'They have sat in Saved for weeks. Move the ones you still want forward and archive the rest.',
      href: applicationsHref('saved'),
      ctaLabel: 'Review',
    });
  }
  return out;
}

/** The soonest interview in the next two weeks, if any. */
export function pickUpcomingInterview(
  plan: TodayPlanPayload | null | undefined,
): UpcomingInterviewItem | null {
  const soon = (plan?.upcomingInterviews ?? []).filter(
    (i) =>
      i.daysUntilInterview != null &&
      i.daysUntilInterview >= 0 &&
      i.daysUntilInterview <= 14,
  );
  soon.sort(
    (a, b) => (a.daysUntilInterview ?? 0) - (b.daysUntilInterview ?? 0),
  );
  return soon[0] ?? null;
}

function whenText(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** One line on what changed since the last visit, or this week's progress; null when there is nothing. */
export function buildRecap(
  plan: TodayPlanPayload | null | undefined,
): string | null {
  if (!plan) return null;
  const since = plan.sinceLastVisit;
  const sinceParts = since?.lastSeenAt
    ? [
        since.newJobsCount > 0
          ? `${plural(since.newJobsCount, 'job')} saved`
          : null,
        since.newHighMatchCount > 0
          ? `${plural(since.newHighMatchCount, 'strong match', 'strong matches')} found`
          : null,
        since.statusChangedCount > 0
          ? `${plural(since.statusChangedCount, 'application')} updated`
          : null,
      ].filter((p): p is string => Boolean(p))
    : [];
  if (sinceParts.length > 0) {
    return `Since your last visit: ${sinceParts.join(' · ')}.`;
  }
  const week = plan.progress;
  const weekParts = [
    week?.applicationsSubmittedWeek > 0
      ? `${plural(week.applicationsSubmittedWeek, 'application')} sent`
      : null,
    week?.followUpsSentWeek > 0
      ? `${plural(week.followUpsSentWeek, 'follow-up')} sent`
      : null,
  ].filter((p): p is string => Boolean(p));
  return weekParts.length > 0 ? `This week: ${weekParts.join(' · ')}.` : null;
}

function recentStatus(item: JobHistoryItem): RecentJobStatus {
  const stage = item.pipelineStatus;
  if (stage === 'interviewing') return 'Interviewing';
  if (stage === 'offered' || stage === 'negotiating' || stage === 'accepted')
    return 'Offer';
  if (stage === 'rejected') return 'Closed';
  if (stage === 'applied' || item.isApplied) return 'Applied';
  if (item.isTailored || item.applicationAssist?.hasTailoredCv)
    return 'Tailored';
  return 'Saved';
}

/** The last `limit` jobs the user touched, each with the one action that moves it forward. */
export function buildRecentJobs(
  items: JobHistoryItem[],
  limit = 3,
): RecentJob[] {
  const at = (j: JobHistoryItem) => j.lastActivityAt ?? j.createdAt;
  return [...items]
    .filter((j) => Number.isFinite(Date.parse(at(j))))
    .sort((a, b) => Date.parse(at(b)) - Date.parse(at(a)))
    .slice(0, limit)
    .map((j) => {
      const status = recentStatus(j);
      const hub = `${ROUTES.applications}?jobAnalysisId=${encodeURIComponent(j.id)}`;
      const applyUrl = clean(j.applyUrl);
      const action: RecentJob['action'] =
        status === 'Saved'
          ? { label: 'Tailor CV', href: `${hub}&tab=resume` }
          : status === 'Tailored' && applyUrl
            ? { label: 'Apply', href: applyUrl, external: true }
            : status === 'Tailored'
              ? { label: 'Continue', href: hub }
              : { label: 'Open', href: hub };
      return {
        id: j.id,
        title: clean(j.jobTitle) ?? clean(j.title) ?? 'Untitled role',
        company: clean(j.company) ?? '',
        logoUrl: j.companyLogoUrl ?? null,
        status,
        at: at(j),
        action,
      };
    });
}

/** The single most useful thing to do next, in plain words. */
export function chooseNextStep(input: {
  hasCv: boolean;
  jobsChecked: number;
  today: HomeAction[];
  plan: TodayPlanPayload | null | undefined;
  interview?: UpcomingInterviewItem | null;
}): NextStep {
  const interview = input.interview;
  if (interview && interview.daysUntilInterview != null) {
    const company = clean(interview.company);
    const role = clean(interview.jobTitle);
    return {
      id: `interview-${interview.id}`,
      title: company
        ? `Get ready for your ${company} interview`
        : 'Get ready for your interview',
      detail: `${role ? `${role} interview` : 'Your interview'} is ${whenText(interview.daysUntilInterview)}. Practise the questions you are likely to get and review the job.`,
      href: clean(interview.ctaHref) ?? ROUTES.interview,
      ctaLabel: clean(interview.ctaLabel) ?? 'Prepare',
      secondary: { label: 'Practise an interview', href: ROUTES.interview },
    };
  }
  if (!input.hasCv) {
    return {
      id: 'add-cv',
      title: 'Add your CV',
      detail:
        'Upload it or build one in a few minutes. Job matches, tailoring and interview practice all start from your CV.',
      href: ROUTES.cv,
      ctaLabel: 'Add my CV',
    };
  }
  if (input.jobsChecked === 0) {
    return {
      id: 'first-check',
      title: 'Check your fit for a job you like',
      detail:
        "Paste any job description. You'll see how well your CV matches, what's missing and what to fix first. It takes about a minute.",
      href: ROUTES.checkJob,
      ctaLabel: 'Check a job',
      secondary: { label: 'Browse jobs instead', href: ROUTES.findJobs },
    };
  }
  const urgent = input.today[0];
  if (urgent) {
    return { ...urgent, id: `next-${urgent.id}` };
  }
  const rm = input.plan?.recommendedMove;
  const headline = clean(rm?.headline);
  const href = clean(rm?.ctaHref);
  if (headline && href) {
    return {
      id: 'recommended',
      title: headline,
      detail: clean(rm?.supporting),
      href,
      ctaLabel: clean(rm?.ctaLabel) ?? 'Open',
    };
  }
  return {
    id: 'find-roles',
    title: 'Find your next role',
    detail:
      'Browse jobs that fit your CV and save the ones you like. We will help you apply and follow up.',
    href: ROUTES.findJobs,
    ctaLabel: 'Find jobs',
    secondary: { label: 'Check a job', href: ROUTES.checkJob },
  };
}

export function greetingFor(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
