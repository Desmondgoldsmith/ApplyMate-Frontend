'use client';

import Link from 'next/link';

import { InfoHint } from '@/components/ui/InfoHint';
import type { StrategicCoachingPayload } from '@/lib/today-plan';
import { TOOLTIP_CONFIDENCE_STRATEGIC_COACHING } from '@/lib/dashboardIntelligenceTooltips';
import { cn } from '@/lib/utils';

type Props = {
  data: StrategicCoachingPayload;
};

export function DashboardStrategicCoachingCard({ data }: Props) {
  const headline = data.headline?.trim() || '';
  const supporting = data.supporting?.trim() || '';
  const ctaLabel = data.ctaLabel?.trim() || '';
  const ctaHref = data.ctaHref?.trim() || '';

  if (!headline || !supporting || !ctaLabel || !ctaHref) return null;

  const confidence =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.min(100, Math.max(0, Math.round(data.confidence)))
      : null;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.08]',
        'bg-gradient-to-br from-[#0E2422]/90 via-[#080A0A]/95 to-[#080A0A]',
        'p-5 shadow-[0_24px_48px_-28px_rgba(0,201,177,0.18)] sm:p-7',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_10%_-20%,rgba(0,201,177,0.14),transparent_55%)]"
      />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CF5EA]/65">
            Strategic Coaching
          </p>
          <h2 className="mt-3 text-[clamp(1.125rem,2.6vw,1.375rem)] font-semibold leading-snug tracking-tight text-white/92">
            {headline}
          </h2>
          <p className="mt-3 max-w-[62ch] text-[13px] leading-relaxed text-white/58 sm:text-[14px]">{supporting}</p>
          {confidence != null ? (
            <div className="mt-5 max-w-xs">
              <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-white/35">
                <span className="inline-flex items-center gap-1.5">
                  <span>Strategic coaching priority</span>
                  <InfoHint
                    text={TOOLTIP_CONFIDENCE_STRATEGIC_COACHING}
                    buttonAriaLabel="What is strategic coaching priority?"
                  />
                </span>
                <span className="tabular-nums text-white/45">{confidence}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/85 to-[#9CF5EA]/55"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 lg:pt-1">
          <Link
            href={ctaHref}
            className={cn(
              'inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[#00C9B1]/50',
              'bg-[#00C9B1]/[0.08] px-5 py-2.5 text-[13px] font-semibold text-[#00C9B1]',
              'shadow-[0_0_0_1px_rgba(0,201,177,0.08)] transition-colors',
              'hover:border-[#00C9B1]/70 hover:bg-[#00C9B1] hover:text-[#080A0A] lg:w-auto',
            )}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
