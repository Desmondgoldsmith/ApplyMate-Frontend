'use client';

import type { KeyboardEvent, Ref } from 'react';
import { Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { CvProfileSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

export type JobBoardFiltersState = {
  q: string;
  workMode: string;
  employmentType: string;
  location: string;
  datePosted: string;
  page: number;
  remoteFirst: boolean;
};

type Props = {
  filters: JobBoardFiltersState;
  qInput: string;
  locationInput: string;
  onQInputChange: (value: string) => void;
  onLocationInputChange: (value: string) => void;
  onImmediateFilterChange: (key: 'workMode' | 'employmentType' | 'datePosted', value: string) => void;
  remoteFirst: boolean;
  onRemoteFirstChange: (value: boolean) => void;
  profiles: CvProfileSummary[];
  selectedProfileId: string;
  onProfileChange: (id: string) => void;
  locationDisabled?: boolean;
  locationDisabledTitle?: string;
  onApplySearch: () => void;
  isFetching?: boolean;
  onResetFilters: () => void;
  locationInputRef?: Ref<HTMLInputElement>;
};

export function JobBoardFilters({
  filters,
  qInput,
  locationInput,
  onQInputChange,
  onLocationInputChange,
  onImmediateFilterChange,
  remoteFirst,
  onRemoteFirstChange,
  profiles,
  selectedProfileId,
  onProfileChange,
  locationDisabled,
  locationDisabledTitle,
  onApplySearch,
  isFetching,
  onResetFilters,
  locationInputRef,
}: Props) {
  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    onApplySearch();
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 sm:p-4">
      <div className="group flex min-h-[48px] min-w-0 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 transition-[border-color,box-shadow] duration-150 focus-within:border-[rgba(0,201,177,0.4)] focus-within:shadow-[0_0_0_3px_rgba(0,201,177,0.08)]">
        <Search className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
        <input
          value={qInput}
          onChange={(e) => onQInputChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search jobs…"
          className="min-h-[44px] min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/30"
        />
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
      <input
        ref={locationInputRef}
        id="job-board-location"
        value={locationInput}
        onChange={(e) => onLocationInputChange(e.target.value)}
        onKeyDown={onSearchKeyDown}
        disabled={locationDisabled}
        title={locationDisabled ? locationDisabledTitle : undefined}
        placeholder={remoteFirst ? 'Remote-first enabled' : 'Current city'}
        className={cn(
          'h-11 min-h-[44px] rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-[rgba(0,201,177,0.45)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)] placeholder:text-white/30',
          locationDisabled && 'cursor-not-allowed opacity-60',
        )}
      />
      <Button
        type="button"
        className="h-11 min-h-[44px] shrink-0 gap-2 border border-[#00C9B1]/40 bg-[#00C9B1]/15 text-sm font-semibold text-[#00C9B1] hover:bg-[#00C9B1]/25"
        onClick={onApplySearch}
        disabled={isFetching}
      >
        {isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Search
      </Button>
      <select
        value={filters.workMode}
        onChange={(e) => onImmediateFilterChange('workMode', e.target.value)}
        className="h-11 min-h-[44px] rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-[rgba(0,201,177,0.45)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)] [&>option]:bg-[#0C0F0F] [&>option]:text-white"
      >
        <option value="" className="bg-[#0C0F0F] text-white">Work mode</option>
        <option value="remote" className="bg-[#0C0F0F] text-white">Remote</option>
        <option value="hybrid" className="bg-[#0C0F0F] text-white">Hybrid</option>
        <option value="onsite" className="bg-[#0C0F0F] text-white">On-site</option>
      </select>
      <select
        value={filters.employmentType}
        onChange={(e) => onImmediateFilterChange('employmentType', e.target.value)}
        className="h-11 min-h-[44px] rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-[rgba(0,201,177,0.45)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)] [&>option]:bg-[#0C0F0F] [&>option]:text-white"
      >
        <option value="" className="bg-[#0C0F0F] text-white">Employment type</option>
        <option value="full-time" className="bg-[#0C0F0F] text-white">Full-time</option>
        <option value="contract" className="bg-[#0C0F0F] text-white">Contract</option>
        <option value="part-time" className="bg-[#0C0F0F] text-white">Part-time</option>
        <option value="internship" className="bg-[#0C0F0F] text-white">Internship</option>
      </select>
      <select
        value={selectedProfileId}
        onChange={(e) => onProfileChange(e.target.value)}
        className="h-11 min-h-[44px] rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-[rgba(0,201,177,0.45)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.1)] [&>option]:bg-[#0C0F0F] [&>option]:text-white"
      >
        {profiles.map((p) => (
          <option key={p.id} value={p.id} className="bg-[#0C0F0F] text-white">
            {p.name}
          </option>
        ))}
      </select>
      <label className="inline-flex h-11 min-h-[44px] items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 text-xs text-white/80">
        <input type="checkbox" checked={remoteFirst} onChange={(e) => onRemoteFirstChange(e.target.checked)} />
        Remote-first
      </label>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <p className="text-[11px] leading-snug text-white/45 sm:max-w-[min(100%,22rem)] sm:pt-0.5">
        Search uses your CV role and city; clear the box and click Search to use that instead of custom keywords.
      </p>
      <Button
        type="button"
        variant="ghost"
        title="Clears keyword override, work mode, employment type, and date range. Your city is not changed."
        className="h-9 shrink-0 self-end border border-white/10 px-3 text-xs font-medium text-white/70 hover:bg-white/[0.04] hover:text-white/90 sm:self-start"
        onClick={onResetFilters}
        disabled={isFetching}
      >
        Reset filters
      </Button>
    </div>
    </div>
  );
}
