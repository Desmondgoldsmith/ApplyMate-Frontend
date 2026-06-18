'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { MatchScoreRing } from '@/components/dashboard/MatchScoreRing';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { InfoHint } from '@/components/ui/InfoHint';
import { trackFunnelEvent } from '@/lib/actionFunnel';
import { resolveExecutionDestination } from '@/lib/executionRouting';
import {
  canonicalRowByRecommendationId,
  isOrchestrationV1,
} from '@/lib/dashboardOrchestrationModel';
import { isAppliedOrLaterState, type TodayPlanItem, type TodayPlanPayload } from '@/lib/today-plan';
import { formatConfidenceShort } from '@/lib/todayPlanLabels';
import { TOOLTIP_JOB_MATCH_SCORE } from '@/lib/dashboardIntelligenceTooltips';
import { cn } from '@/lib/utils';

export function TodaysPlanTopMatchesSection({
  items,
  onInvalidNavigate,
  todayPlanPayload,
}: {
  items: TodayPlanItem[];
  onInvalidNavigate: () => void;
  /** When orchestration v1, canonical CTA + routes from recommendation graph */
  todayPlanPayload?: TodayPlanPayload | null;
}) {
  const router = useRouter();
  const canonById = useMemo(() => {
    if (!todayPlanPayload || !isOrchestrationV1(todayPlanPayload)) return null;
    return canonicalRowByRecommendationId(todayPlanPayload);
  }, [todayPlanPayload]);
  const isAppliedOrLater = (it: TodayPlanItem): boolean => {
    return isAppliedOrLaterState(it.state, it.isApplied);
  };
  const filtered = useMemo(
    () =>
      items.filter((it) => (it.matchScore ?? 0) >= 50 && !isAppliedOrLater(it)),
    [items],
  );
  if (filtered.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold text-white/90">
            Top matches
          </h2>
          <InfoHint
            text={TOOLTIP_JOB_MATCH_SCORE}
            buttonAriaLabel="What are match scores?"
          />
        </div>
        <Link
          href="/dashboard/job-board"
          className="text-[13px] font-medium text-[#00C9B1] hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="space-y-3">
        {filtered.map((it) => {
          const href = resolveExecutionDestination({
            cta: it.cta,
            reasonCodes: it.reasonCodes,
            actionType: it.ctaHint,
            journeyNextRoute: it.journey?.nextRoute ?? null,
            safeFallback: '/dashboard/jobs',
            orchestrationCanonicalRoute:
              canonById?.get(it.id)?.canonicalRoute ?? null,
            orchestrationFallbackRoute:
              canonById?.get(it.id)?.fallbackRoute ?? null,
          }).href;
          const ctaPill =
            canonById?.get(it.id)?.canonicalActionLabel?.trim() ||
            'Review & apply →';
          const company = it.company ?? 'Company';
          const title = it.jobTitle ?? it.title;
          const score = it.matchScore ?? 0;
          const shellClass = cn(
            'group flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.04] p-3 transition-[border-color,background-color] duration-200 motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between sm:p-4',
            href &&
              'cursor-pointer hover:border-white/[0.12] hover:bg-white/[0.055]',
          );
          const matchScan = formatConfidenceShort(score);
          const inner = (
            <>
              <div className="flex min-w-0 flex-1 gap-3">
                <CompanyLogo
                  company={company}
                  logoUrl={it.companyLogoUrl}
                  size="md"
                  className="sm:h-10 sm:w-10"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate text-[14px] font-semibold text-white">
                      {title}
                    </p>
                    {matchScan ? (
                      <span className="shrink-0 rounded-full border border-[#00C9B1]/28 bg-[#00C9B1]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9CF5EA]">
                        {matchScan}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-[13px] font-medium text-white/50">
                    {company}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                <MatchScoreRing score={score} size={36} stroke={2} />
                {href ? (
                  <span className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#00C9B1]/50 px-4 py-2 text-center text-[13px] font-medium text-[#00C9B1] transition-colors group-hover:bg-[#00C9B1] group-hover:text-[#080A0A] sm:min-h-0">
                    {ctaPill}
                  </span>
                ) : (
                  <span className="text-[13px] font-medium text-white/35">
                    Open in app
                  </span>
                )}
              </div>
            </>
          );
          return href ? (
            <Link
              key={it.id}
              href={href}
              className={shellClass}
              onMouseEnter={() => {
                router.prefetch(href);
                trackFunnelEvent('topmatch_prefetched', {
                  itemId: it.id,
                  href,
                });
              }}
              onFocus={() => {
                router.prefetch(href);
                trackFunnelEvent('topmatch_prefetched', {
                  itemId: it.id,
                  href,
                });
              }}
              onClick={(e) => {
                if (isAppliedOrLater(it)) {
                  e.preventDefault();
                  onInvalidNavigate();
                }
              }}
            >
              {inner}
            </Link>
          ) : (
            <div key={it.id} className={shellClass}>
              {inner}
            </div>
          );
        })}
      </div>
    </section>
  );
}
