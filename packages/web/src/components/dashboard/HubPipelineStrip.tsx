'use client';

import { HUB_STAGE_LABELS, HUB_STAGES, type HubStage } from '@/app/(dashboard)/dashboard/jobs/jobHubMerge';
import { cn } from '@/lib/utils';

type Props = {
  counts: Partial<Record<HubStage, number>>;
  filter: HubStage | 'all';
  onFilterChange: (stage: HubStage | 'all') => void;
};

export function HubPipelineStrip({ counts, filter, onFilterChange }: Props) {
  const stages = HUB_STAGES;

  return (
    <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
      <div className="flex min-w-[720px] gap-0">
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={cn(
            'pipeline-chevron flex-[1.1] shrink-0 items-center justify-center px-1 py-2 text-center transition-colors',
            filter === 'all'
              ? 'bg-[rgba(0,201,177,0.12)] text-[#00C9B1]'
              : 'bg-[#111616] text-white/45 hover:bg-[#00C9B1]/15 hover:text-[#00C9B1]/90',
          )}
        >
          <span className="text-[20px] font-medium leading-none tabular-nums">
            {stages.reduce((acc, s) => acc + (counts[s] ?? 0), 0)}
          </span>
          <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.06em] text-white/50">
            All jobs
          </span>
        </button>
        {stages.map((stage) => {
          const n = counts[stage] ?? 0;
          const active = filter === stage;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => onFilterChange(stage)}
              className={cn(
                'pipeline-chevron flex-1 shrink-0 items-center justify-center px-1 py-2 text-center transition-colors',
                active
                  ? 'bg-[rgba(0,201,177,0.12)] text-[#00C9B1]'
                  : 'bg-[#111616] text-white/45 hover:bg-[#00C9B1]/15 hover:text-[#00C9B1]/90',
              )}
            >
              <span className="text-[20px] font-medium leading-none tabular-nums">{n}</span>
              <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.06em] text-white/50">
                {HUB_STAGE_LABELS[stage]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
