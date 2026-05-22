'use client';

import Link from 'next/link';

import { MatchScoreRing } from '@/components/dashboard/MatchScoreRing';
import { InfoHint } from '@/components/ui/InfoHint';
import {
  effectiveDeterministicIndexValue,
  type CareerMomentumPayload,
  type CareerMomentumTier,
  type DashboardEmptyStatePayload,
} from '@/lib/today-plan';
import {
  deterministicIndexTooltipText,
  TOOLTIP_CAREER_MOMENTUM_CONFIDENCE,
  TOOLTIP_CAREER_MOMENTUM_SCORE,
} from '@/lib/dashboardIntelligenceTooltips';
import { cn } from '@/lib/utils';

type Props = {
  data: CareerMomentumPayload;
  phase15Empty?: DashboardEmptyStatePayload | null;
};

function tierBadgeSurface(tier: CareerMomentumTier | null): string {
  switch (tier) {
    case 'building':
      return 'border-white/14 bg-white/[0.06] text-white/58';
    case 'steady':
      return 'border-amber-400/22 bg-amber-500/[0.09] text-amber-100/85';
    case 'strong':
      return 'border-[#00C9B1]/32 bg-[#00C9B1]/[0.11] text-[#9CF5EA]';
    case 'surging':
      return 'border-[#00C9B1]/48 bg-[#00C9B1]/[0.16] text-[#B8FFF4]';
    default:
      return 'border-white/12 bg-white/[0.05] text-white/45';
  }
}

function tierLabel(tier: CareerMomentumTier | null): string | null {
  if (!tier) return null;
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export function DashboardCareerMomentumCard({ data, phase15Empty }: Props) {
  const headline = data.headline?.trim() || '';
  const supporting = data.supporting?.trim() || '';
  const opportunity = data.opportunity?.trim() || '';
  const strengths = data.strengths ?? [];

  const confidence =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.min(100, Math.max(0, Math.round(data.confidence)))
      : null;

  const momentumValue = effectiveDeterministicIndexValue(data.momentumIndex, data.score);
  const momentumTooltipText = deterministicIndexTooltipText(data.momentumIndex, TOOLTIP_CAREER_MOMENTUM_SCORE);

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/[0.08]',
        'bg-gradient-to-br from-[#0a1614]/95 via-[#080A0A] to-[#080A0A]',
        'p-5 sm:p-7',
        'shadow-[0_24px_52px_-28px_rgba(0,201,177,0.16)] ring-1 ring-white/[0.05]',
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_85%_-15%,rgba(0,201,177,0.1),transparent_50%)]"
      />

      <div className="relative space-y-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CF5EA]/65">Career Momentum</p>

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-start gap-2">
              {headline ? (
                <>
                  <p className="text-[clamp(1.5rem,4.5vw,2.25rem)] font-semibold tabular-nums tracking-tight text-white/92">
                    {headline}
                  </p>
                  <InfoHint
                    text={momentumTooltipText}
                    buttonClassName="mt-1 align-top"
                    buttonAriaLabel="What is career momentum?"
                  />
                </>
              ) : null}
            </div>
            {data.tier ? (
              <span
                className={cn(
                  'inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide',
                  tierBadgeSurface(data.tier),
                )}
              >
                {tierLabel(data.tier)}
              </span>
            ) : null}
          </div>

          {momentumValue != null ? (
            <div className="flex flex-col items-center gap-2 sm:items-end">
              <MatchScoreRing
                score={momentumValue}
                size={112}
                stroke={5}
                unit="score"
                label={
                  data.momentumIndex?.label?.trim()
                    ? data.momentumIndex.label.trim()
                    : headline
                      ? `Career momentum: ${headline}`
                      : 'Career momentum index'
                }
                className="mx-auto shrink-0 sm:mx-0"
              />
              {data.momentumIndex?.label?.trim() ? (
                <p className="max-w-[12rem] text-center text-[10px] font-medium leading-snug text-white/42 sm:text-left">
                  {data.momentumIndex.label.trim()}
                </p>
              ) : null}
              {!headline ? (
                <InfoHint text={momentumTooltipText} buttonAriaLabel="What is career momentum?" />
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-5 border-t border-white/[0.06] pt-5">
          {supporting ? (
            <p className="text-[13px] leading-relaxed text-white/58 sm:text-[14px]">{supporting}</p>
          ) : data.tier === 'steady' ? (
            <p className="text-[13px] leading-relaxed text-white/58 sm:text-[14px]">
              You&apos;re staying consistent — that&apos;s what moves the needle.
            </p>
          ) : null}

          {strengths.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/38">
                What&apos;s working
              </p>
              <ul className="mt-2 list-disc space-y-2 pl-5 marker:text-[#00C9B1]/55">
                {strengths.map((line, idx) => (
                  <li key={`${idx}:${line}`} className="text-[13px] leading-relaxed text-white/72">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {opportunity ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CF5EA]/55">
                Where to focus next
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/78 sm:text-[14px]">{opportunity}</p>
            </div>
          ) : null}

          {confidence != null ? (
            <div className="max-w-sm">
              <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-white/35">
                <span className="inline-flex items-center gap-1.5">
                  <span>Momentum clarity</span>
                  <InfoHint text={TOOLTIP_CAREER_MOMENTUM_CONFIDENCE} buttonAriaLabel="What is momentum clarity?" />
                </span>
                <span className="tabular-nums text-white/45">{confidence}%</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/70 to-[#9CF5EA]/45"
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>
          ) : null}

          {momentumValue == null && strengths.length === 0 && !opportunity ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className="text-[13px] leading-relaxed text-white/58">
                {phase15Empty?.message?.trim() ||
                  'Your momentum score appears after your first week of activity. Analyze a job or update your CV to start building it.'}
              </p>
              <Link
                href={phase15Empty?.ctaHref?.trim() || '/dashboard/jobs/analyze'}
                className="mt-3 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[#00C9B1] hover:underline"
              >
                {phase15Empty?.ctaLabel?.trim() || 'Analyze a job →'}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
