import type { HubStage } from '@/app/(dashboard)/dashboard/jobs/jobHubMerge';

/** Mirrors server `HubPipelineStage` — kept local to avoid api ↔ parser cycles. */
export type JobHubPipelineStageSlug =
  | 'saved'
  | 'applied'
  | 'interviewing'
  | 'offered'
  | 'negotiating'
  | 'accepted'
  | 'rejected';

export type JobHubPipelineStepState = 'complete' | 'current' | 'upcoming' | 'unavailable';

export type JobHubPipelineStep = {
  id: string;
  label: string;
  shortLabel?: string | null;
  state: JobHubPipelineStepState;
  order: number;
  targetPipelineStage?: JobHubPipelineStageSlug | null;
  clickable: boolean;
  terminal?: boolean;
};

export type JobHubPipelineStepperPayload = {
  steps: JobHubPipelineStep[];
  currentStepId: string;
  statusHint?: string | null;
  terminal?: boolean;
};

export type JobHubGuidanceTaskState = 'pending' | 'completed' | 'skipped' | 'blocked';

export type JobHubGuidanceTask = {
  id: string;
  label: string;
  state: JobHubGuidanceTaskState;
  autoCompleted: boolean;
  userCompleted?: boolean;
  /** When false, checkbox is display-only (verified / auto-completed tasks). */
  userToggleable?: boolean;
  completedAt?: string | null;
  optional?: boolean;
  supporting?: string | null;
  tips?: string[];
  scheduledLabel?: string | null;
  scheduledFor?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  secondaryCtaLabel?: string | null;
  secondaryCtaHref?: string | null;
};

export type JobHubGuidanceJobContext = {
  applicationId?: string | null;
  jobAnalysisId?: string | null;
  hubBookmarkId?: string | null;
};

/** Tasks the user may tick/untick manually — everything else is verified server-side. */
const MANUAL_GUIDANCE_TASK_IDS = new Set([
  'research_company',
  'identify_contacts',
  'research_prepare',
  'tech_check',
  'research_market_rate',
  'negotiate',
  'follow_up_interview',
  'share_win',
  'archive_if_silent',
]);

const GUIDANCE_TASK_SUPPORTING_FALLBACKS: Record<string, string> = {
  follow_up_2:
    'Still no reply? Send a brief second note referencing your original application, restating your interest, and asking if there is an update on timing.',
  follow_up_3:
    'This is your last polite nudge. Keep it short, thank them for their time, and mention you remain interested without sounding pushy.',
  identify_contacts:
    'Look for the hiring manager, recruiter, or team lead on LinkedIn or the company site. A short, personalized note often gets a faster read than a portal application alone.',
  archive_if_silent:
    'If you still have not heard back, archive so your dashboard stays focused on active roles.',
};

/** In-panel action — handled by Job Hub archive confirm, not router navigation. */
export const JOB_HUB_GUIDANCE_ARCHIVE_HREF = '#applymate:hub-archive';

export function isJobHubGuidanceArchiveHref(href: string | null | undefined): boolean {
  if (!href?.trim()) return false;
  const h = href.trim();
  if (h === JOB_HUB_GUIDANCE_ARCHIVE_HREF) return true;
  try {
    const u = new URL(h, 'https://applymate.local');
    return (u.searchParams.get('action') ?? '').trim().toLowerCase() === 'archive';
  } catch {
    return false;
  }
}

export type JobHubGuidancePayload = {
  phaseId: string;
  phaseLabel: string;
  title: string;
  headline: string;
  percentComplete: number;
  tasks: JobHubGuidanceTask[];
  summary?: string | null;
  generatedAt?: string | null;
};

export type JobHubContextEnrichment = {
  pipelineStepper?: JobHubPipelineStepperPayload | null;
  guidance?: JobHubGuidancePayload | null;
};

const PIPELINE_STEP_STATES = new Set<JobHubPipelineStepState>([
  'complete',
  'current',
  'upcoming',
  'unavailable',
]);

const GUIDANCE_TASK_STATES = new Set<JobHubGuidanceTaskState>([
  'pending',
  'completed',
  'skipped',
  'blocked',
]);

const HUB_PIPELINE_STAGES = new Set<JobHubPipelineStageSlug>([
  'saved',
  'applied',
  'interviewing',
  'offered',
  'negotiating',
  'accepted',
  'rejected',
]);

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const v = o[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function parseHubPipelineStageValue(v: unknown): JobHubPipelineStageSlug | null {
  if (typeof v !== 'string') return null;
  const s = v.trim() as JobHubPipelineStageSlug;
  return HUB_PIPELINE_STAGES.has(s) ? s : null;
}

function parsePipelineStep(raw: unknown): JobHubPipelineStep | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, 'id');
  const label = pickStr(o, 'label');
  if (!id || !label) return null;
  const stateRaw = pickStr(o, 'state');
  const state =
    stateRaw && PIPELINE_STEP_STATES.has(stateRaw as JobHubPipelineStepState)
      ? (stateRaw as JobHubPipelineStepState)
      : 'upcoming';
  const orderRaw = o.order;
  const order =
    typeof orderRaw === 'number' && Number.isFinite(orderRaw)
      ? Math.max(0, Math.round(orderRaw))
      : 0;
  const targetPipelineStage = parseHubPipelineStageValue(
    o.targetPipelineStage ?? o.target_pipeline_stage,
  );
  return {
    id,
    label,
    shortLabel: pickStr(o, 'shortLabel', 'short_label'),
    state,
    order,
    targetPipelineStage,
    clickable: o.clickable === true,
    terminal: o.terminal === true ? true : undefined,
  };
}

export function parseJobHubPipelineStepper(raw: unknown): JobHubPipelineStepperPayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const currentStepId = pickStr(o, 'currentStepId', 'current_step_id');
  const stepsRaw = o.steps;
  if (!currentStepId || !Array.isArray(stepsRaw)) return null;
  const steps = stepsRaw
    .map(parsePipelineStep)
    .filter((x): x is JobHubPipelineStep => x != null)
    .sort((a, b) => a.order - b.order);
  if (!steps.length) return null;
  return {
    steps,
    currentStepId,
    statusHint: pickStr(o, 'statusHint', 'status_hint'),
    terminal: o.terminal === true ? true : undefined,
  };
}

function parseGuidanceTask(raw: unknown): JobHubGuidanceTask | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, 'id');
  const label = pickStr(o, 'label');
  if (!id || !label) return null;
  const stateRaw = pickStr(o, 'state');
  const state =
    stateRaw && GUIDANCE_TASK_STATES.has(stateRaw as JobHubGuidanceTaskState)
      ? (stateRaw as JobHubGuidanceTaskState)
      : 'pending';
  const tipsRaw = o.tips;
  const tips = Array.isArray(tipsRaw)
    ? tipsRaw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : undefined;
  return {
    id,
    label,
    state,
    autoCompleted: o.autoCompleted === true || o.auto_completed === true,
    userCompleted:
      o.userCompleted === true || o.user_completed === true ? true : undefined,
    userToggleable:
      o.userToggleable === false || o.user_toggleable === false
        ? false
        : o.userToggleable === true || o.user_toggleable === true
          ? true
          : undefined,
    completedAt: pickStr(o, 'completedAt', 'completed_at'),
    optional: o.optional === true ? true : undefined,
    supporting: pickStr(o, 'supporting', 'body', 'message'),
    tips: tips?.length ? tips : undefined,
    scheduledLabel: pickStr(o, 'scheduledLabel', 'scheduled_label'),
    scheduledFor: pickStr(o, 'scheduledFor', 'scheduled_for'),
    ctaLabel: pickStr(o, 'ctaLabel', 'cta_label'),
    ctaHref: pickStr(o, 'ctaHref', 'cta_href'),
    secondaryCtaLabel: pickStr(o, 'secondaryCtaLabel', 'secondary_cta_label'),
    secondaryCtaHref: pickStr(o, 'secondaryCtaHref', 'secondary_cta_href'),
  };
}

export function parseJobHubGuidance(raw: unknown): JobHubGuidancePayload | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const phaseId = pickStr(o, 'phaseId', 'phase_id');
  const phaseLabel = pickStr(o, 'phaseLabel', 'phase_label');
  const title = pickStr(o, 'title') ?? 'Guidance';
  const headline = pickStr(o, 'headline') ?? `${phaseLabel ?? 'Pipeline'} steps`;
  if (!phaseId || !phaseLabel) return null;
  const percentRaw = o.percentComplete ?? o.percent_complete;
  const percentComplete =
    typeof percentRaw === 'number' && Number.isFinite(percentRaw)
      ? Math.max(0, Math.min(100, Math.round(percentRaw)))
      : 0;
  const tasksRaw = o.tasks;
  const tasks = Array.isArray(tasksRaw)
    ? tasksRaw.map(parseGuidanceTask).filter((x): x is JobHubGuidanceTask => x != null)
    : [];
  return {
    phaseId,
    phaseLabel,
    title,
    headline,
    percentComplete,
    tasks,
    summary: pickStr(o, 'summary'),
    generatedAt: pickStr(o, 'generatedAt', 'generated_at'),
  };
}

export function parseJobHubContextEnrichment(
  raw: Record<string, unknown>,
): JobHubContextEnrichment {
  const pipelineStepper = parseJobHubPipelineStepper(
    raw.pipelineStepper ?? raw.pipeline_stepper,
  );
  const guidance = parseJobHubGuidance(raw.guidance);
  return {
    ...(pipelineStepper ? { pipelineStepper } : {}),
    ...(guidance ? { guidance } : {}),
  };
}

export function isGuidanceTaskDone(task: JobHubGuidanceTask): boolean {
  return (
    task.state === 'completed' ||
    task.autoCompleted ||
    task.userCompleted === true
  );
}

export function isManualGuidanceTaskId(taskId: string): boolean {
  return MANUAL_GUIDANCE_TASK_IDS.has(taskId);
}

/** Whether the user may tick/untick this row (manual-only tasks). */
export function isGuidanceTaskUserToggleable(task: JobHubGuidanceTask): boolean {
  if (task.state === 'blocked') return false;
  if (task.autoCompleted) return false;
  if (task.userToggleable === false) return false;
  if (task.userToggleable === true) return true;
  if (task.optional === true) return true;
  if (!isManualGuidanceTaskId(task.id)) return false;
  return true;
}

export function buildJobHubJobsHref(
  ctx: JobHubGuidanceJobContext,
  params: Record<string, string>,
): string {
  const q = new URLSearchParams();
  if (ctx.applicationId?.trim()) q.set('applicationId', ctx.applicationId.trim());
  else if (ctx.jobAnalysisId?.trim()) q.set('jobId', ctx.jobAnalysisId.trim());
  else if (ctx.hubBookmarkId?.trim()) q.set('bookmarkId', ctx.hubBookmarkId.trim());
  for (const [k, v] of Object.entries(params)) {
    if (v.trim()) q.set(k, v.trim());
  }
  return `/dashboard/jobs?${q.toString()}`;
}

function jobHubHrefHasTab(href: string | null | undefined, tab: string): boolean {
  if (!href?.trim()) return false;
  try {
    const u = new URL(href, 'https://applymate.local');
    const t = (u.searchParams.get('tab') ?? '').trim().toLowerCase().replace(/_/g, '-');
    return t === tab || t === `${tab}-letter`;
  } catch {
    return false;
  }
}

function jobHubHrefHasTemplate(href: string | null | undefined, template: string): boolean {
  if (!href?.trim()) return false;
  try {
    const u = new URL(href, 'https://applymate.local');
    const raw = (u.searchParams.get('template') ?? '').trim().toLowerCase();
    return raw === template || raw.replace(/-/g, '_') === template;
  } catch {
    return false;
  }
}

/** Correct known task CTAs when backend href/tab targets are wrong or missing. */
export function resolveGuidanceTaskActions(
  task: JobHubGuidanceTask,
  ctx: JobHubGuidanceJobContext,
): Pick<
  JobHubGuidanceTask,
  'ctaLabel' | 'ctaHref' | 'secondaryCtaLabel' | 'secondaryCtaHref' | 'supporting' | 'tips'
> {
  const supporting =
    task.supporting?.trim() ||
    GUIDANCE_TASK_SUPPORTING_FALLBACKS[task.id] ||
    null;

  const base = {
    ctaLabel: task.ctaLabel,
    ctaHref: task.ctaHref,
    secondaryCtaLabel: task.secondaryCtaLabel,
    secondaryCtaHref: task.secondaryCtaHref,
    supporting,
    tips: task.tips,
  };

  switch (task.id) {
    case 'draft_cover_letter':
      if (jobHubHrefHasTab(base.ctaHref, 'cover')) return base;
      return {
        ...base,
        ctaLabel: base.ctaLabel?.trim() || 'Open cover letter',
        ctaHref: buildJobHubJobsHref(ctx, { tab: 'cover' }),
        secondaryCtaLabel: null,
        secondaryCtaHref: null,
      };
    case 'identify_contacts':
      if (jobHubHrefHasTemplate(base.ctaHref, 'hiring_manager_outreach')) return base;
      return {
        ...base,
        ctaLabel: base.ctaLabel?.trim() || 'Open cold outreach template',
        ctaHref: buildJobHubJobsHref(ctx, {
          tab: 'email',
          template: 'hiring_manager_outreach',
        }),
      };
    case 'follow_up_1':
    case 'follow_up_2':
    case 'follow_up_3':
    case 'applied_follow_up_1':
    case 'applied_follow_up_2':
    case 'applied_follow_up_3':
      if (
        jobHubHrefHasTab(base.ctaHref, 'email') &&
        (jobHubHrefHasTemplate(base.ctaHref, 'follow_up_after_silence') ||
          jobHubHrefHasTemplate(base.ctaHref, 'follow-up-no-response'))
      ) {
        return base;
      }
      return {
        ...base,
        ctaLabel: base.ctaLabel?.trim() || 'Draft follow-up email',
        ctaHref: buildJobHubJobsHref(ctx, {
          tab: 'email',
          template: 'follow_up_after_silence',
        }),
      };
    case 'thank_you':
      if (jobHubHrefHasTemplate(base.ctaHref, 'thank_you_post_interview')) return base;
      return {
        ...base,
        ctaHref:
          base.ctaHref?.trim() ||
          buildJobHubJobsHref(ctx, {
            tab: 'email',
            template: 'thank_you_post_interview',
          }),
      };
    case 'tailor_cv':
      if (base.ctaHref?.includes('openTailor=1')) return base;
      if (ctx.jobAnalysisId?.trim()) {
        return {
          ...base,
          ctaHref: `/dashboard/jobs/analyze?jobId=${encodeURIComponent(ctx.jobAnalysisId.trim())}&openTailor=1`,
        };
      }
      return base;
    case 'practice_interview':
      if (base.ctaHref?.includes('/dashboard/interview')) return base;
      if (ctx.jobAnalysisId?.trim()) {
        return {
          ...base,
          ctaHref: `/dashboard/interview?jobAnalysisId=${encodeURIComponent(ctx.jobAnalysisId.trim())}`,
        };
      }
      return base;
    case 'archive_if_silent':
      if (isJobHubGuidanceArchiveHref(base.ctaHref)) {
        return {
          ...base,
          ctaLabel: base.ctaLabel?.trim() || 'Archive this job',
          secondaryCtaLabel: null,
          secondaryCtaHref: null,
        };
      }
      return {
        ...base,
        ctaLabel: 'Archive this job',
        ctaHref: JOB_HUB_GUIDANCE_ARCHIVE_HREF,
        secondaryCtaLabel: null,
        secondaryCtaHref: null,
      };
    default:
      return base;
  }
}

export function enrichGuidancePayload(
  guidance: JobHubGuidancePayload,
  ctx: JobHubGuidanceJobContext,
): JobHubGuidancePayload {
  return {
    ...guidance,
    tasks: guidance.tasks.map((task) => {
      const resolved = resolveGuidanceTaskActions(task, ctx);
      return {
        ...task,
        supporting: resolved.supporting,
        tips: resolved.tips,
        ctaLabel: resolved.ctaLabel,
        ctaHref: resolved.ctaHref,
        secondaryCtaLabel: resolved.secondaryCtaLabel,
        secondaryCtaHref: resolved.secondaryCtaHref,
      };
    }),
  };
}

/** Map stepper step id → Job Hub column for existing stage-change handlers. */
export function hubPipelineStepIdToHubStage(
  stepId: string,
  opts: { hasAnalysis: boolean },
): HubStage | null {
  switch (stepId) {
    case 'bookmarked':
      return 'bookmarked';
    case 'preparing':
      return opts.hasAnalysis ? 'analyzed' : 'bookmarked';
    case 'applied':
      return 'applied';
    case 'interviewing':
      return 'interviewing';
    case 'negotiating':
      return 'negotiating';
    case 'offered':
      return 'offered';
    case 'accepted':
      return 'accepted';
    default:
      return null;
  }
}

/** First finite match score from tracked job and/or cached job detail. */
export function resolveTrackedJobMatchScore(
  job: { matchScore: number | null; jobAnalysisId: string | null },
  jobDetailMatchScore?: number | null,
): number | undefined {
  const candidates = [job.matchScore, jobDetailMatchScore];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return Math.max(0, Math.round(c));
  }
  return undefined;
}

/** Optimistic stepper refresh after user picks a pipeline step. */
export function optimisticPipelineStepper(
  stepper: JobHubPipelineStepperPayload,
  targetStepId: string,
): JobHubPipelineStepperPayload {
  const target = stepper.steps.find((s) => s.id === targetStepId);
  if (!target) return stepper;
  const targetOrder = target.order;
  return {
    ...stepper,
    currentStepId: targetStepId,
    steps: stepper.steps.map((s) => {
      if (s.order < targetOrder) return { ...s, state: 'complete' as const };
      if (s.id === targetStepId) return { ...s, state: 'current' as const };
      if (s.state === 'unavailable') return s;
      return { ...s, state: 'upcoming' as const };
    }),
  };
}

/** Parse `tab` from a Job Hub deep link for in-panel navigation. */
export function parseJobHubDetailTabFromHref(href: string):
  | 'analysis'
  | 'description'
  | 'cover'
  | 'notes'
  | 'email'
  | 'resume'
  | null {
  try {
    const u = new URL(href, 'https://applymate.local');
    if (!u.pathname.startsWith('/dashboard/jobs')) return null;
    const t = (u.searchParams.get('tab') ?? '').trim().toLowerCase();
    if (t === 'email-templates' || t === 'email') return 'email';
    if (t === 'cover-letter' || t === 'cover_letter') return 'cover';
    if (
      t === 'analysis' ||
      t === 'description' ||
      t === 'cover' ||
      t === 'notes' ||
      t === 'resume'
    ) {
      return t;
    }
    return null;
  } catch {
    return null;
  }
}
