'use client';

import Link from 'next/link';

import { InfoHint } from '@/components/ui/InfoHint';
import type { GoalStrategicCoachingPayload } from '@/lib/today-plan';
import { TOOLTIP_CONFIDENCE_STRATEGIC_COACHING } from '@/lib/dashboardIntelligenceTooltips';
import { cn } from '@/lib/utils';

type Props = {
  data: GoalStrategicCoachingPayload;
};

function timeHorizonLabel(h: GoalStrategicCoachingPayload['timeHorizon']): string | null {
  switch (h) {
    case 'today':
      return 'Today';
    case 'this_week':
      return 'This week';
    case 'this_month':
      return 'This month';
    case 'quarter':
      return 'This quarter';
    default:
      return null;
  }
}

export function DashboardGoalStrategicCoachingCard({ data }: Props) {
  const headline = data.headline?.trim() || '';
  const supporting = data.supporting?.trim() || '';
  const recommendation = data.recommendation?.trim() || '';
  const reasoning = data.reasoning?.trim() || '';
  const ctaLabel = data.ctaLabel?.trim() || '';
  const ctaHref = data.ctaHref?.trim() || '';

  if (!ctaLabel || !ctaHref) return null;

  if (!headline && !supporting && !recommendation) return null;

  const confidence =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.min(100, Math.max(0, Math.round(data.confidence)))
      : null;

  const horizon = timeHorizonLabel(data.timeHorizon);

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border border-[#00C9B1]/18',
        'bg-gradient-to-br from-[#062823]/95 via-[#080A0A]/98 to-[#080A0A]',
        'p-6 shadow-[0_28px_64px_-32px_rgba(0,201,177,0.22)] ring-1 ring-[#00C9B1]/10 sm:p-8',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_100%_0%,rgba(0,201,177,0.12),transparent_50%)]"
      />

      <div className="relative">
        {/* Header: label + CTA share one row on desktop — no orphan empty column */}
        <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CF5EA]/75">Goals &amp; strategy</p>
          <Link
            href={ctaHref}
            className={cn(
              'inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-full border border-[#00C9B1]/50',
              'bg-[#00C9B1]/[0.08] px-5 py-2.5 text-[13px] font-semibold text-[#00C9B1]',
              'transition-colors hover:border-[#00C9B1]/70 hover:bg-[#00C9B1] hover:text-[#080A0A] sm:w-auto',
            )}
          >
            {ctaLabel}
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-8">
          <div className="min-w-0 space-y-4">
            {headline ? (
              <h2 className="text-[clamp(1.125rem,2.2vw,1.375rem)] font-semibold leading-snug tracking-tight text-white/92">
                {headline}
              </h2>
            ) : null}
            {supporting ? (
              <p className="text-[13px] leading-relaxed text-white/58 sm:text-[14px]">{supporting}</p>
            ) : null}
          </div>

          <div className="min-w-0 space-y-5">
            {recommendation ? (
              <div className="rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/[0.06] px-4 py-4 sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CF5EA]/90">Recommendation</p>
                <p className="mt-2 text-[13px] leading-relaxed text-white/82 sm:text-[14px]">{recommendation}</p>
              </div>
            ) : null}
            {reasoning ? (
              <p className="text-[12px] leading-relaxed text-white/45 sm:text-[13px]">
                <span className="font-medium text-white/55">Why</span> — {reasoning}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/40">
              {horizon ? (
                <span className="rounded-full border border-white/12 px-2.5 py-1 text-white/55">{horizon}</span>
              ) : null}
              {confidence != null ? (
                <span className="inline-flex items-center gap-1.5 tabular-nums text-white/48">
                  <span>Goal coaching priority</span>
                  <InfoHint text={TOOLTIP_CONFIDENCE_STRATEGIC_COACHING} buttonAriaLabel="What is goal coaching priority?" />
                  <span>{confidence}%</span>
                </span>
              ) : null}
            </div>

            {confidence != null ? (
              <div className="w-full">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/85 to-[#9CF5EA]/55"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
