'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import { InfoHint } from '@/components/ui/InfoHint';
import { emitDashboardBehaviorEvent } from '@/lib/dashboardBehaviorEvents';
import { TOOLTIP_STRATEGIC_MOVE_PRIORITY } from '@/lib/dashboardIntelligenceTooltips';
import type {
  StrategicRecommendationImpact,
  StrategicRecommendationPayload,
} from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  data: StrategicRecommendationPayload;
};

function impactBadgeClass(impact: StrategicRecommendationImpact | null): string {
  switch (impact) {
    case 'very_high':
      return 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200';
    case 'high':
      return 'border-amber-400/40 bg-amber-400/10 text-amber-100';
    case 'medium':
      return 'border-sky-400/35 bg-sky-500/10 text-sky-100';
    case 'low':
    default:
      return 'border-white/15 bg-white/[0.06] text-white/55';
  }
}

function impactLabel(impact: StrategicRecommendationImpact | null): string {
  switch (impact) {
    case 'very_high':
      return 'Very high impact';
    case 'high':
      return 'High impact';
    case 'medium':
      return 'Medium impact';
    case 'low':
      return 'Low impact';
    default:
      return 'Impact';
  }
}

function confidenceBucket(confidence: number | null): string | null {
  if (confidence == null || !Number.isFinite(confidence)) return null;
  const c = Math.max(0, Math.min(100, Math.round(confidence)));
  const bucket = Math.floor(c / 10) * 10;
  return `${bucket}-${bucket + 9}`;
}

export function StrategicRecommendationCard({ data }: Props) {
  const headline = data.headline?.trim() || '';
  const supporting = data.supporting?.trim() || '';
  const reasoning = data.reasoning?.trim() || '';
  const ctaLabel = data.ctaLabel?.trim() || '';
  const ctaHref = data.ctaHref?.trim() || '';

  const viewedRef = useRef(false);

  const confidencePct =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.max(0, Math.min(100, Math.round(data.confidence)))
      : null;

  useEffect(() => {
    if (viewedRef.current) return;
    if (!headline || !supporting || !ctaLabel || !ctaHref) return;
    viewedRef.current = true;
    emitDashboardBehaviorEvent({
      eventName: 'dashboard_strategic_recommendation_viewed',
      context: {
        category: data.category ?? null,
        expectedImpact: data.expectedImpact ?? null,
        confidence: confidencePct,
        confidenceBucket: confidenceBucket(confidencePct),
      },
    });
  }, [headline, supporting, ctaLabel, ctaHref, data.category, data.expectedImpact, confidencePct]);

  if (!headline || !supporting || !ctaLabel || !ctaHref) return null;

  const rat = data.rationale;

  return (
    <section
      className={cn(
        'rounded-3xl border border-[#00C9B1]/22 bg-gradient-to-br from-[#00C9B1]/[0.09] via-white/[0.04] to-white/[0.02] p-5 shadow-[0_24px_56px_-32px_rgba(0,201,177,0.28)] ring-1 ring-[#00C9B1]/15 sm:p-6',
      )}
    >
      {/* Header: label + impact | primary CTA — full row, not a cramped left column */}
      <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-[11px] font-medium tracking-wide text-white/42">Best Strategic Move</p>
          <span
            className={cn(
              'inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              impactBadgeClass(data.expectedImpact),
            )}
          >
            {impactLabel(data.expectedImpact)}
          </span>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
          <Link
            href={ctaHref}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#00C9B1]/50 bg-[#00C9B1]/10 px-5 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A] sm:w-auto"
            onClick={() => {
              emitDashboardBehaviorEvent({
                eventName: 'dashboard_strategic_recommendation_clicked',
                context: {
                  category: data.category ?? null,
                  expectedImpact: data.expectedImpact ?? null,
                  confidence: confidencePct,
                  confidenceBucket: confidenceBucket(confidencePct),
                  route: ctaHref,
                },
              });
            }}
          >
            {ctaLabel}
          </Link>
          {confidencePct != null ? (
            <p className="flex flex-wrap items-center justify-center gap-1.5 text-center text-[11px] text-white/38 sm:justify-end sm:text-right">
              <span className="inline-flex items-center gap-1">
                <span>Move priority</span>
                <InfoHint text={TOOLTIP_STRATEGIC_MOVE_PRIORITY} buttonAriaLabel="What is move priority?" />
              </span>
              <span className="tabular-nums text-white/50">{confidencePct}%</span>
            </p>
          ) : null}
        </div>
      </div>

      {/* Narrative uses full card width */}
      <div className="mt-5 space-y-3">
        <h2 className="text-[17px] font-semibold leading-snug text-white/95 sm:text-[18px]">{headline}</h2>
        <p className="text-[14px] leading-relaxed text-white/65">{supporting}</p>
        {reasoning ? (
          <p className="border-l-2 border-[#00C9B1]/25 pl-4 text-[13px] leading-relaxed text-white/48">{reasoning}</p>
        ) : null}
      </div>

      {rat &&
      (rat.matchScore != null ||
        rat.daysUntilInterview != null ||
        rat.daysSinceLastActivity != null ||
        rat.cvScore != null ||
        rat.applicationsInProgress != null) ? (
        <dl className="mt-6 grid grid-cols-1 gap-3 border-t border-white/[0.06] pt-5 text-[12px] text-white/45">
          {rat.matchScore != null ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <dt>Match score</dt>
              <dd className="tabular-nums font-medium text-white/70">{rat.matchScore}%</dd>
            </div>
          ) : null}
          {rat.daysUntilInterview != null ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <dt>Days until interview</dt>
              <dd className="tabular-nums font-medium text-white/70">{rat.daysUntilInterview}</dd>
            </div>
          ) : null}
          {rat.daysSinceLastActivity != null ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <dt>Days since activity</dt>
              <dd className="tabular-nums font-medium text-white/70">{rat.daysSinceLastActivity}</dd>
            </div>
          ) : null}
          {rat.cvScore != null ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <dt>CV score</dt>
              <dd className="tabular-nums font-medium text-white/70">{rat.cvScore}%</dd>
            </div>
          ) : null}
          {rat.applicationsInProgress != null ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <dt>Applications in progress</dt>
              <dd className="tabular-nums font-medium text-white/70">{rat.applicationsInProgress}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}
