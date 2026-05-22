'use client';

import Link from 'next/link';

import { InfoHint } from '@/components/ui/InfoHint';
import type { OpportunityDetectionPayload } from '@/lib/today-plan';
import { TOOLTIP_CONFIDENCE_OPPORTUNITY } from '@/lib/dashboardIntelligenceTooltips';
import { cn } from '@/lib/utils';

type Props = {
  data: OpportunityDetectionPayload;
};

export function DashboardOpportunityDetectionCard({ data }: Props) {
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
    <section className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 shadow-[0_20px_48px_-32px_rgba(0,0,0,0.5)] ring-1 ring-white/[0.04] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-white/38">Best opportunity in your pipeline</p>
          <p className="mt-2 text-[15px] font-medium leading-snug text-white/88">{headline}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">{supporting}</p>
          {confidence != null ? (
            <div className="mt-4 max-w-xs">
              <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-white/35">
                <span className="inline-flex items-center gap-1.5">
                  <span>Opportunity priority</span>
                  <InfoHint text={TOOLTIP_CONFIDENCE_OPPORTUNITY} buttonAriaLabel="What is opportunity priority?" />
                </span>
                <span className="tabular-nums text-white/45">{confidence}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/75 to-[#9CF5EA]/50"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
        <Link
          href={ctaHref}
          className={cn(
            'inline-flex min-h-[44px] items-center justify-center rounded-full border border-[#00C9B1]/45 px-4 py-2 text-[13px] font-semibold text-[#00C9B1] transition-colors hover:bg-[#00C9B1] hover:text-[#080A0A]',
          )}
        >
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}

