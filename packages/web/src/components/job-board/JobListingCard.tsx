'use client';

import { useMemo } from 'react';

import type { JobListingDto } from '@/lib/api';
import { buildJobMetadataParts } from '@/lib/jobBoardDisplay';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { cn } from '@/lib/utils';

export function JobListingCard({
  job,
  active,
  onClick,
  onPrefetch,
}: {
  job: JobListingDto;
  active?: boolean;
  onClick: () => void;
  onPrefetch?: (job: JobListingDto) => void;
}) {
  const meta = useMemo(() => buildJobMetadataParts(job).join(' · '), [job]);
  const posted =
    job.datePosted && !Number.isNaN(Date.parse(job.datePosted))
      ? formatRelativeEdited(job.datePosted)
      : null;
  const isTopMatch = job.highlight?.isTopMatch === true;
  const isNew = job.novelty?.isNewSinceLastVisit === true;
  const tier = job.ranking?.tier;
  const rankScore = job.ranking?.score;
  const whyLine =
    job.ranking?.recommendation?.trim() ||
    job.explanation?.whyThisJob?.trim() ||
    job.whyThisJobShort?.trim() ||
    job.snippet ||
    job.description;
  const matchedSkills = (job.explanation?.matchedSkills ?? []).slice(0, 4);
  const showAiVerified =
    job.matchPreview?.refinedReady === true &&
    typeof job.matchPreview?.refinedScore === 'number' &&
    Number.isFinite(job.matchPreview.refinedScore);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => onPrefetch?.(job)}
      onFocus={() => onPrefetch?.(job)}
      className={cn(
        'group relative w-full rounded-xl px-4 py-4 text-left transition-colors duration-150 sm:px-5',
        active
          ? 'bg-[rgba(0,201,177,0.06)] before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-[#00C9B1]'
          : 'bg-transparent hover:bg-white/[0.04]',
        isTopMatch && 'ring-1 ring-[#00C9B1]/30 shadow-[0_0_0_1px_rgba(0,201,177,0.12),0_6px_24px_rgba(0,201,177,0.16)]',
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.08] sm:h-10 sm:w-10">
          {job.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[14px] font-semibold text-white/70">
              {job.company?.charAt(0)?.toUpperCase() ?? '?'}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 pr-14 sm:pr-16">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="line-clamp-1 min-w-0 flex-1 text-[14px] font-semibold leading-snug tracking-tight text-white">
              {job.title}
            </p>
          </div>
          <p className="mt-1 truncate text-[13px] font-medium text-white/45">{job.company}</p>
          {meta ? <p className="mt-0.5 truncate text-[13px] text-white/45">{meta}</p> : null}
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[#8af3e7]/85">
            {whyLine}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {isNew ? (
              <span className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                New
              </span>
            ) : null}
            {tier === 'APPLY_NOW' ? (
              <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                Apply now{typeof rankScore === 'number' ? ` · ${rankScore}%` : ''}
              </span>
            ) : tier === 'CONSIDER' ? (
              <span className="rounded-full border border-amber-400/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                Consider{typeof rankScore === 'number' ? ` · ${rankScore}%` : ''}
              </span>
            ) : tier === 'LOW_MATCH' ? (
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/45">
                Low match
              </span>
            ) : null}
            {showAiVerified ? (
              <span className="rounded-full border border-[#00C9B1]/25 bg-[#00C9B1]/10 px-2 py-0.5 text-[10px] font-medium text-[#8af3e7]">
                AI verified
              </span>
            ) : null}
            {job.highlight?.label && !tier ? (
              <span className="rounded-full border border-[#00C9B1]/35 bg-[#00C9B1]/12 px-2 py-0.5 text-[10px] font-semibold text-[#7ef4e6]">
                {job.highlight.label}
              </span>
            ) : null}
            {matchedSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/50"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute right-3 top-4 flex flex-col items-end gap-1.5 text-right sm:right-4">
          {posted ? <span className="text-[11px] font-medium text-white/30">{posted}</span> : null}
        </div>
      </div>
    </div>
  );
}
