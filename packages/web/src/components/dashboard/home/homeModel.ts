import type {
  CvProfileSummary,
  HubPipelineStage,
  JobHistoryItem,
} from '@/lib/api';
import type { TodayPlanPayload } from '@/lib/today-plan';

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
  id: 'account' | 'cv' | 'check' | 'track';
  label: string;
  done: boolean;
  href: string;
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
  ];
}

function clean(value: string | null | undefined): string | null {
  const v = value?.replace(/\s+/g, ' ').trim();
  return v ? v : null;
}

/** Up to `limit` things worth doing today, from follow-ups first, then urgent and focus items. */
export function buildTodayActions(
  plan: TodayPlanPayload | null | undefined,
  limit = 3,
): HomeAction[] {
  if (!plan) return [];
  const out: HomeAction[] = [];
  const seen = new Set<string>();
  const push = (a: HomeAction | null) => {
    if (!a || out.length >= limit) return;
    const key = `${a.href}|${a.title.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(a);
  };

  for (const row of plan.followUpJobs ?? []) {
    const title = clean(row.headline);
    const href = clean(row.ctaHref);
    if (!title || !href) continue;
    push({
      id: `follow-${row.id}`,
      title,
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
  return out;
}

/** The single most useful thing to do next, in plain words. */
export function chooseNextStep(input: {
  hasCv: boolean;
  jobsChecked: number;
  today: HomeAction[];
  plan: TodayPlanPayload | null | undefined;
}): NextStep {
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
