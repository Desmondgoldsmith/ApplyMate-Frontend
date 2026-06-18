'use client';

import Link from 'next/link';

import { SemanticOutlookBadge } from '@/components/dashboard/SemanticOutlookBadge';
import { InfoHint } from '@/components/ui/InfoHint';
import { formatTimelineOutlookLabel } from '@/lib/dashboardSemanticOutlook';
import {
  TOOLTIP_PREDICTIVE_OFFER_OUTLOOK,
  TOOLTIP_PREDICTIVE_INTERVIEW_OUTLOOK,
  TOOLTIP_PREDICTIVE_TIMELINE_OUTLOOK,
  tooltipPipelineHealthText,
} from '@/lib/dashboardIntelligenceTooltips';
import { DashboardExpandableText } from '@/components/dashboard/DashboardExpandableText';
import { cleanAiText } from '@/lib/dashboardDisplayCopy';
import type {
  DashboardEmptyStatePayload,
  PredictiveOutlookPayload,
  PredictivePipelineHealth,
} from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  data: PredictiveOutlookPayload;
  /** Phase 15 — overrides generic empty copy when outlook signal is weak. */
  phase15Empty?: DashboardEmptyStatePayload | null;
};

function healthBadgeSurface(health: PredictivePipelineHealth | null): string {
  switch (health) {
    case 'fragile':
      return 'border-rose-400/28 bg-rose-500/[0.08] text-rose-100/88';
    case 'building':
      return 'border-white/14 bg-white/[0.06] text-white/62';
    case 'healthy':
      return 'border-[#00C9B1]/32 bg-[#00C9B1]/[0.11] text-[#9CF5EA]';
    case 'strong':
      return 'border-[#00C9B1]/48 bg-[#00C9B1]/[0.18] text-[#C6FFF5]';
    default:
      return 'border-white/12 bg-white/[0.05] text-white/48';
  }
}

function healthLabel(health: PredictivePipelineHealth | null): string | null {
  if (!health) return null;
  return health.charAt(0).toUpperCase() + health.slice(1);
}

export function DashboardPredictiveOutlookCard({ data, phase15Empty }: Props) {
  const headline = cleanAiText(data.headline?.trim() ?? '');
  const supporting = cleanAiText(data.supporting?.trim() ?? '');

  const timelineLabel = formatTimelineOutlookLabel(
    data.timelineOutlook,
    data.timelineOutlookLabel,
  );

  const confidence =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.min(100, Math.max(0, Math.round(data.confidence)))
      : null;

  const hasAnyMetric =
    data.interviewOutlook != null ||
    data.offerOutlook != null ||
    timelineLabel != null ||
    data.pipelineHealth != null;

  const isEmpty = !headline && !supporting && !hasAnyMetric && confidence == null;

  if (isEmpty) {
    const custom = phase15Empty?.message?.trim();
    const href = phase15Empty?.ctaHref?.trim() || '/dashboard/jobs';
    const ctaLabel = phase15Empty?.ctaLabel?.trim() || 'Go to Job Hub →';
    return (
      <section
        className={cn(
          'relative overflow-hidden rounded-3xl border border-white/[0.08]',
          'bg-gradient-to-br from-[#0e1c1a]/95 via-[#080A0A] to-[#080A0A]',
          'p-3.5 sm:p-6 md:p-7',
          'shadow-[0_24px_56px_-28px_rgba(0,201,177,0.16)] ring-1 ring-white/[0.05]',
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CF5EA]/65">Where your search is heading</p>
        {custom ? (
          <p className="mt-4 max-w-[72ch] text-[13px] leading-relaxed text-white/58">{cleanAiText(custom)}</p>
        ) : (
          <>
            <p className="mt-4 max-w-[72ch] text-[13px] leading-relaxed text-white/58">
              Outlook summaries need at least 3 applications in your pipeline.
            </p>
            <p className="mt-2 max-w-[72ch] text-[13px] leading-relaxed text-white/48">
              Keep applying. This section unlocks automatically.
            </p>
          </>
        )}
        <Link
          href={href}
          className="mt-5 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[#00C9B1] hover:underline"
        >
          {ctaLabel}
        </Link>
      </section>
    );
  }

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/[0.08]',
        'bg-gradient-to-br from-[#0e1c1a]/95 via-[#080A0A] to-[#080A0A]',
        'p-3.5 sm:p-6 md:p-7',
        'shadow-[0_24px_56px_-28px_rgba(0,201,177,0.16)] ring-1 ring-white/[0.05]',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_55%_at_50%_-10%,rgba(0,201,177,0.09),transparent_55%)]"
      />

      <div className="relative space-y-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CF5EA]/65">
          Where your search is heading
        </p>

        {headline ? (
          <h2 className="text-[clamp(1.125rem,2.8vw,1.45rem)] font-semibold leading-snug tracking-tight text-white/92">
            {headline}
          </h2>
        ) : null}

        {supporting ? (
          <DashboardExpandableText
            text={supporting}
            maxChars={120}
            className="max-w-[72ch] text-[13px] leading-relaxed text-white/58 sm:text-[14px]"
          />
        ) : null}

        {hasAnyMetric ? (
          <p className="max-w-[72ch] text-[13px] leading-relaxed text-white/58 sm:text-[14px]">
            Here is what your job search looks like right now.
          </p>
        ) : null}

        {hasAnyMetric ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.interviewOutlook ? (
              <div className="min-w-0 min-h-[88px] rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 sm:py-4">
                <SemanticOutlookBadge
                  outlook={data.interviewOutlook}
                  defaultTitle="Interview chances"
                  tooltipFallback={TOOLTIP_PREDICTIVE_INTERVIEW_OUTLOOK}
                  infoAriaLabel="About interview outlook"
                />
              </div>
            ) : null}

            {data.offerOutlook ? (
              <div className="min-w-0 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 sm:py-4">
                <SemanticOutlookBadge
                  outlook={data.offerOutlook}
                  defaultTitle="Offer progress"
                  tooltipFallback={TOOLTIP_PREDICTIVE_OFFER_OUTLOOK}
                  infoAriaLabel="About offer outlook"
                />
              </div>
            ) : null}

            {timelineLabel ? (
              <div className="min-w-0 min-h-[88px] rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 sm:py-4">
                <div className="flex items-start justify-between gap-1.5">
                  <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/38 leading-tight">
                    Estimated timeline
                  </p>
                  <InfoHint
                    text={TOOLTIP_PREDICTIVE_TIMELINE_OUTLOOK}
                    buttonAriaLabel="About timeline outlook"
                  />
                </div>
                <p className="mt-2 text-[15px] font-semibold leading-snug text-white/88">
                  {timelineLabel}
                </p>
              </div>
            ) : null}

            <div className="min-w-0 min-h-[88px] rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 sm:py-4">
              <div className="flex items-start justify-between gap-1.5">
                <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">
                  Pipeline health
                </p>
                <InfoHint
                  text={tooltipPipelineHealthText(data.pipelineHealth)}
                  buttonAriaLabel="What is pipeline health?"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {data.pipelineHealth ? (
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold tracking-wide',
                      healthBadgeSurface(data.pipelineHealth),
                    )}
                  >
                    {healthLabel(data.pipelineHealth)}
                  </span>
                ) : (
                  <span className="text-[18px] font-semibold text-white/35">—</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
