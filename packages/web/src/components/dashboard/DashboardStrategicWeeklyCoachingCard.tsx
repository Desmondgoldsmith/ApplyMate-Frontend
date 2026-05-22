'use client';

import {
  Brain,
  Briefcase,
  Mic2,
  PauseCircle,
  RotateCcw,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { InfoHint } from '@/components/ui/InfoHint';
import { TOOLTIP_WEEKLY_STRATEGIC_COACHING_FIT } from '@/lib/dashboardIntelligenceTooltips';
import type {
  StrategicWeeklyCoachingPayload,
  StrategicWeeklyCoachingReason,
  StrategicWeeklyCoachingTone,
} from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  data: StrategicWeeklyCoachingPayload;
};

function toneShell(tone: StrategicWeeklyCoachingTone | null): { ring: string; glow: string; badge: string } {
  switch (tone) {
    case 'celebratory':
      return {
        ring: 'border-[#00C9B1]/28 shadow-[0_0_0_1px_rgba(0,201,177,0.12)]',
        glow: 'bg-[radial-gradient(ellipse_90%_60%_at_0%_0%,rgba(0,201,177,0.16),transparent_55%)]',
        badge: 'border-[#B8FFF4]/35 bg-[#00C9B1]/[0.12] text-[#C6FFF5]',
      };
    case 'encouraging':
      return {
        ring: 'border-white/[0.1]',
        glow: 'bg-[radial-gradient(ellipse_90%_55%_at_15%_-10%,rgba(156,245,234,0.08),transparent_50%)]',
        badge: 'border-white/14 bg-white/[0.06] text-white/62',
      };
    case 'focused':
      return {
        ring: 'border-amber-400/22',
        glow: 'bg-[radial-gradient(ellipse_85%_50%_at_10%_0%,rgba(251,191,36,0.09),transparent_52%)]',
        badge: 'border-amber-400/28 bg-amber-500/[0.08] text-amber-100/85',
      };
    case 'urgent':
      return {
        ring: 'border-rose-400/28',
        glow: 'bg-[radial-gradient(ellipse_80%_45%_at_0%_0%,rgba(251,113,133,0.1),transparent_50%)]',
        badge: 'border-rose-400/30 bg-rose-500/[0.1] text-rose-100/88',
      };
    default:
      return {
        ring: 'border-white/[0.08]',
        glow: 'bg-[radial-gradient(ellipse_90%_55%_at_15%_-10%,rgba(156,245,234,0.06),transparent_50%)]',
        badge: 'border-white/12 bg-white/[0.05] text-white/48',
      };
  }
}

function reasonIcon(reason: StrategicWeeklyCoachingReason | null): LucideIcon | null {
  switch (reason) {
    case 'analysis_paralysis':
      return Brain;
    case 'low_application_volume':
      return Briefcase;
    case 'interview_focus':
      return Mic2;
    case 'low_fit_targeting':
      return Target;
    case 'stalled_pipeline':
      return PauseCircle;
    case 'strong_momentum':
      return TrendingUp;
    case 'recovery_mode':
      return RotateCcw;
    default:
      return null;
  }
}

export function DashboardStrategicWeeklyCoachingCard({ data }: Props) {
  const headline = data.headline?.trim() || '';
  const supporting = data.supporting?.trim() || '';
  const recommendedAction = data.recommendedAction?.trim() || '';

  const confidence =
    typeof data.confidence === 'number' && Number.isFinite(data.confidence)
      ? Math.min(100, Math.max(0, Math.round(data.confidence)))
      : null;

  const Icon = reasonIcon(data.reason);
  const shell = toneShell(data.tone);

  const hasCopy = headline || supporting || recommendedAction;

  if (!hasCopy && confidence == null && !data.tone && !data.reason) return null;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br from-[#0c1816]/95 via-[#080A0A] to-[#080A0A] p-5 sm:p-7',
        shell.ring,
      )}
    >
      <div aria-hidden className={cn('pointer-events-none absolute inset-0', shell.glow)} />

      <div className="relative space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CF5EA]/65">
            Strategic Weekly Coaching
          </p>
          {data.tone ? (
            <span
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                shell.badge,
              )}
            >
              {data.tone}
            </span>
          ) : null}
          {data.reason ? (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wide text-white/35">
              {data.reason}
            </span>
          ) : null}
        </div>

        {headline ? (
          <div className="flex flex-wrap items-start gap-3">
            {Icon ? (
              <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00C9B1]/22 bg-[#00C9B1]/[0.07] text-[#9CF5EA]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            ) : null}
            <h2 className="min-w-0 flex-1 text-[clamp(1.125rem,2.8vw,1.45rem)] font-semibold leading-snug tracking-tight text-white/92">
              {headline}
            </h2>
          </div>
        ) : Icon ? (
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#00C9B1]/22 bg-[#00C9B1]/[0.07] text-[#9CF5EA]">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        ) : null}

        {supporting ? (
          <p className="max-w-[72ch] text-[13px] leading-relaxed text-white/58 sm:text-[14px]">{supporting}</p>
        ) : null}

        {recommendedAction ? (
          <div className="rounded-xl border border-[#00C9B1]/22 bg-[#00C9B1]/[0.06] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CF5EA]/65">
              Recommended action
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/85 sm:text-[14px]">{recommendedAction}</p>
          </div>
        ) : null}

        {confidence != null ? (
          <div className="max-w-sm pt-1">
            <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-white/35">
              <span className="inline-flex items-center gap-1.5">
                <span>Weekly coaching fit</span>
                <InfoHint text={TOOLTIP_WEEKLY_STRATEGIC_COACHING_FIT} buttonAriaLabel="What is weekly coaching fit?" />
              </span>
              <span className="tabular-nums text-white/45">{confidence}%</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/65 to-[#9CF5EA]/45"
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
