'use client';

import { cn } from '@/lib/utils';

import { HUB_STAGE_SHORT_LABELS, type HubStage, type TrackedJob } from './jobHubMerge';

const ADVANCED_PIPELINE_STAGES: HubStage[] = [
  'applied',
  'interviewing',
  'offered',
  'negotiating',
  'accepted',
  'rejected',
];

function originLabel(origin: TrackedJob['origin']): string {
  switch (origin) {
    case 'job_board':
      return 'Board';
    case 'analysis':
      return 'From analysis';
    case 'application':
      return 'Application';
    case 'mixed':
      return 'Mixed source';
    default:
      return 'Unknown';
  }
}

function stateLabel(state: TrackedJob['state']): string {
  switch (state) {
    case 'bookmarked':
      return 'Bookmarked';
    case 'analyzed':
      return 'Analyzed';
    case 'applied':
      return 'Applied';
    default:
      return 'Unknown';
  }
}

export function JobHubBadges({ job, className }: { job: TrackedJob; className?: string }) {
  const origin = originLabel(job.origin);
  const stageLabel = HUB_STAGE_SHORT_LABELS[job.stage];
  const legacyState = stateLabel(job.state);
  const showLegacyState =
    job.state !== job.stage &&
    !(job.state === 'applied' && job.stage === 'analyzed') &&
    !(job.state === 'analyzed' && ADVANCED_PIPELINE_STAGES.includes(job.stage));
  const showOrigin =
    origin.trim().toLowerCase() !== stageLabel.trim().toLowerCase() &&
    origin.trim().toLowerCase() !== legacyState.trim().toLowerCase();

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {showOrigin ? (
        <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/65">
          {origin}
        </span>
      ) : null}
      <span className="inline-flex items-center rounded-full border border-[#00C9B1]/30 bg-[#00C9B1]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#00C9B1]">
        {stageLabel}
      </span>
      {showLegacyState ? (
        <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-white/55">
          {legacyState}
        </span>
      ) : null}
    </div>
  );
}
