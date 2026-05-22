'use client';

import { cn } from '@/lib/utils';
import { JobHubBadges } from './JobHubBadges';
import { JobHubRowMenu } from './JobHubRowMenu';

import { HUB_STAGE_LABELS, HUB_STAGES, type HubStage, type TrackedJob } from './jobHubMerge';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

type Props = {
  jobs: TrackedJob[];
  selectedKey: string | null;
  onOpenJob: (job: TrackedJob) => void;
  onStageChange: (job: TrackedJob, stage: HubStage) => void;
  onPrefetchJob?: (job: TrackedJob) => void;
  archivingJobKey?: string | null;
  onRequestArchiveJob: (job: TrackedJob) => void;
  onRequestPipelineRemoveJob: (job: TrackedJob) => void;
  onRequestUnbookmarkJob: (job: TrackedJob) => void;
};

export function JobHubTable({
  jobs,
  selectedKey,
  onOpenJob,
  onStageChange,
  onPrefetchJob,
  archivingJobKey = null,
  onRequestArchiveJob,
  onRequestPipelineRemoveJob,
  onRequestUnbookmarkJob,
}: Props) {
  if (jobs.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-white/45">No jobs match this filter.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="w-full min-w-[820px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] text-[11px] font-semibold uppercase tracking-[0.06em] text-white/40">
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Company</th>
            <th className="px-4 py-3 font-medium">Match</th>
            <th className="px-4 py-3 font-medium">Stage</th>
            <th className="px-4 py-3 font-medium">Saved</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((row) => {
            const selected = selectedKey === row.key;
            return (
              <tr
                key={row.key}
                className={cn(
                  'cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-[#00C9B1]/12',
                  selected && 'bg-white/[0.06]',
                )}
                onClick={() => onOpenJob(row)}
                onMouseEnter={() => onPrefetchJob?.(row)}
              >
                <td className="px-4 py-3 font-medium text-white">
                  <div>
                    <p>{row.title}</p>
                    <JobHubBadges job={row} className="mt-1.5" />
                  </div>
                </td>
                <td className="px-4 py-3 text-white/75">{row.company}</td>
                <td className="px-4 py-3 tabular-nums text-white/80">
                  {row.matchScore != null ? `${Math.round(row.matchScore)}%` : '—'}
                </td>
                <td
                  className="px-4 py-3"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <select
                    value={row.stage}
                    onChange={(e) => onStageChange(row, e.target.value as HubStage)}
                    className="max-w-[200px] rounded-lg border border-white/15 bg-[#111616] px-2 py-1.5 text-xs text-white focus:border-[#00C9B1]/50 focus:outline-none"
                  >
                    {HUB_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {HUB_STAGE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 tabular-nums text-white/50">{formatDate(row.createdAt)}</td>
                <td
                  className="px-4 py-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end">
                    <JobHubRowMenu
                      job={row}
                      disabled={archivingJobKey === row.key}
                      onRequestArchive={onRequestArchiveJob}
                      onRequestRemoveFromPipeline={onRequestPipelineRemoveJob}
                      onRequestUnbookmark={onRequestUnbookmarkJob}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
