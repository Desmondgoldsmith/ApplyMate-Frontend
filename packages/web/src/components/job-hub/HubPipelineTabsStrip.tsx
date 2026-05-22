'use client';

import {
  HUB_PIPELINE_TAB_LABELS,
  HUB_PIPELINE_TABS,
  type HubPipelineTab,
} from '@/app/(dashboard)/dashboard/jobs/jobHubPipelineTabs';
import { cn } from '@/lib/utils';

type Props = {
  counts: Partial<Record<HubPipelineTab, number>>;
  filter: HubPipelineTab;
  onFilterChange: (tab: HubPipelineTab) => void;
};

export function HubPipelineTabsStrip({ counts, filter, onFilterChange }: Props) {
  const tabs: HubPipelineTab[] = ['all', ...HUB_PIPELINE_TABS];

  return (
    <div className="overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
      <div className="flex min-w-[min(100%,920px)] gap-1.5">
        {tabs.map((tab) => {
          const n = counts[tab] ?? 0;
          const active = filter === tab;
          const isAccepted = tab === 'accepted';
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onFilterChange(tab)}
              className={cn(
                'shrink-0 rounded-xl border px-3 py-2 text-left transition',
                active
                  ? 'border-[#00C9B1]/40 bg-[#00C9B1]/12 text-[#8af3e7]'
                  : 'border-white/10 bg-white/[0.03] text-white/55 hover:border-white/20 hover:text-white/80',
                isAccepted && !active && 'border-amber-400/20',
              )}
            >
              <span className="block text-[18px] font-semibold tabular-nums leading-none">
                {n}
                {isAccepted ? <span className="ml-0.5 text-amber-300">★</span> : null}
              </span>
              <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.06em] opacity-80">
                {HUB_PIPELINE_TAB_LABELS[tab]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
