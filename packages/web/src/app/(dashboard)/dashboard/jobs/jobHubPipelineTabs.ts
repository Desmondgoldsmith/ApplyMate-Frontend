import type { TrackedJob } from './jobHubMerge';

/** Phase 5 filter tabs — client-side only; kanban columns remain HubStage. */
export type HubPipelineTab =
  | 'all'
  | 'discovery'
  | 'analyzing'
  | 'tailoring'
  | 'applied'
  | 'interviewing'
  | 'negotiating'
  | 'accepted';

export const HUB_PIPELINE_TABS: HubPipelineTab[] = [
  'discovery',
  'analyzing',
  'tailoring',
  'applied',
  'interviewing',
  'negotiating',
  'accepted',
];

export const HUB_PIPELINE_TAB_LABELS: Record<HubPipelineTab, string> = {
  all: 'All jobs',
  discovery: 'Discovery',
  analyzing: 'Analyzing',
  tailoring: 'Tailoring',
  applied: 'Applied',
  interviewing: 'Interviewing',
  negotiating: 'Negotiating',
  accepted: 'Accepted',
};

export function derivePipelineTab(job: TrackedJob): Exclude<HubPipelineTab, 'all'> {
  if (job.stage === 'accepted') return 'accepted';
  if (job.stage === 'negotiating') return 'negotiating';
  if (job.stage === 'interviewing') return 'interviewing';
  if (job.stage === 'applied' || job.isApplied) return 'applied';
  const tailored = job.applicationAssist?.hasTailoredCv === true;
  if (tailored && (job.stage === 'analyzed' || job.stage === 'bookmarked')) return 'tailoring';
  if (job.hasAnalysis || job.stage === 'analyzed') return 'analyzing';
  return 'discovery';
}

export function jobMatchesPipelineTab(job: TrackedJob, tab: HubPipelineTab): boolean {
  if (tab === 'all') return true;
  return derivePipelineTab(job) === tab;
}

export function pipelineTabCounts(jobs: TrackedJob[]): Partial<Record<HubPipelineTab, number>> {
  const c: Partial<Record<HubPipelineTab, number>> = { all: jobs.length };
  for (const j of jobs) {
    const t = derivePipelineTab(j);
    c[t] = (c[t] ?? 0) + 1;
  }
  return c;
}

/** Subtle status label for cards (Phase 5.2). */
export function pipelineStatusLabel(job: TrackedJob): string {
  return HUB_PIPELINE_TAB_LABELS[derivePipelineTab(job)];
}
