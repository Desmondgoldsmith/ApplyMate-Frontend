'use client';

import { FileText, Plus, Star, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { MatchScoreRing } from '@/components/dashboard/MatchScoreRing';
import { InfoHint } from '@/components/ui/InfoHint';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { TOOLTIP_CV_SCORE } from '@/lib/dashboardIntelligenceTooltips';
import { cn } from '@/lib/utils';

type DashboardCvProfileTeaserProps = {
  onNewCv: () => void;
};

export function DashboardCvProfileTeaser({ onNewCv }: DashboardCvProfileTeaserProps) {
  const { displayRows, listInconsistent, isBootstrapping } = useCvProfileRowsDisplay();
  const totalCount = displayRows.length;
  const featured = useMemo(
    () => displayRows.find((p) => p.isDefault) ?? displayRows[0] ?? null,
    [displayRows],
  );

  const score = featured?.score ?? null;
  const scoreNum = score !== null && Number.isFinite(score) ? score : null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-white/90">Resume Clinic</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-9 min-h-[44px] rounded-full border border-[#00C9B1]/45 px-3 text-[13px] font-medium text-[#00C9B1] hover:bg-[#00C9B1]/10 sm:min-h-9"
            onClick={onNewCv}
          >
            <Plus className="h-3.5 w-3.5" />
            New CV
          </Button>
          {!isBootstrapping && totalCount > 0 ? (
            <Link
              href="/dashboard/cv-profiles"
              className="text-[13px] font-medium text-[#00C9B1] hover:underline"
            >
              View all →
            </Link>
          ) : null}
        </div>
      </div>

      <div>
        {isBootstrapping ? (
          <Skeleton height={120} borderRadius={14} />
        ) : !featured ? (
          <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-6 py-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-[#00C9B1]" strokeWidth={1.5} />
            <p className="mt-2 text-[15px] font-semibold text-white">No CV yet</p>
            <p className="mt-1 text-[13px] font-medium text-white/50">Create a CV to get started</p>
            <Button type="button" className="mt-5" onClick={onNewCv}>
              Create CV
            </Button>
          </div>
        ) : (
          <>
            {listInconsistent ? (
              <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-100/90">
                Profile list API returned no rows; showing your primary CV. If this persists, check{' '}
                <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_API_URL</code> and auth — then fix the list
                endpoint on the server.
              </p>
            ) : null}
            <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-4 transition-[border-color,background-color] duration-150 hover:border-white/[0.12] hover:bg-white/[0.045] sm:p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <Star
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      featured.isDefault ? 'fill-[#00C9B1] text-[#00C9B1]' : 'text-white/25',
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-white">{featured.name}</p>
                    {featured.headline?.trim() ? (
                      <p className="mt-1 line-clamp-2 text-[13px] font-medium text-white/50">{featured.headline}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {featured.isDefault ? (
                        <span className="rounded-full border border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.1)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#00C9B1]">
                          Default
                        </span>
                      ) : null}
                      {featured.originalTemplate ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
                          <Upload className="h-2.5 w-2.5" aria-hidden />
                          Uploaded
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1.5">
                      <MatchScoreRing
                        score={scoreNum}
                        size={48}
                        stroke={2.5}
                        unit="score"
                        label={
                          scoreNum != null ? `CV score ${scoreNum} out of 100` : 'CV score not available'
                        }
                      />
                      <InfoHint
                        text={TOOLTIP_CV_SCORE}
                        buttonClassName="self-start pt-0.5"
                        buttonAriaLabel="What is this CV score?"
                      />
                    </div>
                    <span className="text-[10px] font-medium uppercase tracking-wide text-white/35">
                      Out of 100
                    </span>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
                    <Link
                      href={`/dashboard/cv?profileId=${encodeURIComponent(featured.id)}`}
                      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#00C9B1]/50 px-4 py-2 text-center text-[13px] font-medium text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A] sm:min-h-0 sm:w-auto"
                    >
                      Edit →
                    </Link>
                    {totalCount > 1 ? (
                      <Link
                        href="/dashboard/cv-profiles"
                        className="text-center text-[12px] font-medium text-white/45 hover:text-white/70 sm:text-right"
                      >
                        Manage all ({totalCount})
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-[11px] font-medium text-white/30">
                Last edited {formatRelativeEdited(featured.updatedAt)}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
