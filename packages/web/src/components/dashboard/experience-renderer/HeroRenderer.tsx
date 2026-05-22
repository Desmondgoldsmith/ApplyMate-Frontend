'use client';

import Link from 'next/link';

import { composeHeroSecondary } from '@/components/dashboard/assistant-voice/narrative';
import { stripTechnicalTokens } from '@/components/dashboard/assistant-voice/humanize';
import { AiUsageBadge } from '@/components/dashboard/AiUsageBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { ensureSafeDashboardHref } from '@/lib/executionRouting';
import { cn } from '@/lib/utils';

import {
  confidenceBandFromScore,
  heroPrimaryCtaClass,
  isRecoveryVisualMode,
} from '@/components/dashboard/experience-renderer/experienceGrammar';
import { PersonalizedRichText } from '@/components/dashboard/experience-renderer/PersonalizedRichText';

type HeroCommittedAsideProps = {
  variant: 'committed';
  column: 'aside';
  emotionalTone: string | null;
  mode: string | null;
  fatigueAdjusted: boolean | null;
  heroConfidenceScore?: number | null;
  showPrimaryCta: boolean;
  ctaHref: string | null;
  ctaLabel: string | null;
  /** Coaching line (personalized next-best-action, continuation helper, or compressed narrative microcopy). */
  ctaHelper: string | null;
  /**
   * Compressed narrative: render `ctaHelper` once, muted, **below** the primary CTA.
   * Legacy: microcopy stays **above** the CTA when present.
   */
  microcopyBelowCta?: boolean;
  /** When true, never show the fallback motivational paragraph. */
  suppressFallbackTip?: boolean;
  minutes: number | null;
  showLimitInHero: boolean;
  onCtaClick?: () => void;
};

type HeroCommittedPrimaryProps = {
  variant: 'committed';
  column: 'primary';
  /** Dominant narrative — one clear thought. */
  title: string;
  subtitle: string | null;
  arcLabel: string | null;
  continuityLine: string | null;
  /** Backend “why” — shown as a quiet tertiary whisper when present. */
  whyMatters: string | null;
  /** Deterministic reassurance when hero doesn’t carry emotional closure. */
  reassuranceWhisper: string | null;
  emotionalTone: string | null;
  mode: string | null;
  fatigueAdjusted: boolean | null;
  /** Optional typography from mode atmosphere. */
  primaryTitleClass?: string;
  /**
   * Compressed assistant narrative: tighter type scale so the greeting stays the warm anchor
   * and the headline does not overpower it.
   */
  compressedVisual?: boolean;
};

export type HeroRendererProps =
  | { variant: 'skeleton' }
  | HeroCommittedAsideProps
  | HeroCommittedPrimaryProps;

export function HeroRenderer(props: HeroRendererProps) {
  if (props.variant === 'skeleton') {
    return (
      <>
        <div className="mt-5 w-full max-w-[65ch]">
          <Skeleton height={26} width="100%" borderRadius={10} />
        </div>
        <div className="mt-5 w-full max-w-[65ch]">
          <Skeleton height={14} width="100%" borderRadius={8} />
        </div>
      </>
    );
  }

  if (props.column === 'aside') {
    const {
      emotionalTone,
      mode,
      fatigueAdjusted,
      heroConfidenceScore,
      showPrimaryCta,
      ctaHref,
      ctaLabel,
      ctaHelper,
      suppressFallbackTip,
      microcopyBelowCta,
      minutes,
      showLimitInHero,
      onCtaClick,
    } = props;
    const helper = ctaHelper?.trim() ?? '';
    const showMicrocopyAboveCta = Boolean(helper && !microcopyBelowCta);
    const showMicrocopyBelowCta = Boolean(helper && microcopyBelowCta);
    const recoveryVisual = isRecoveryVisualMode(mode, fatigueAdjusted);
    const band = confidenceBandFromScore(heroConfidenceScore ?? null);
    const safeHref = ctaHref ? ensureSafeDashboardHref(ctaHref, '/dashboard/job-board').href : null;

    return (
      <>
        {showLimitInHero ? (
          <AiUsageBadge variant="default" className="w-full sm:w-auto" />
        ) : showPrimaryCta && safeHref && ctaLabel ? (
          <div className="flex max-w-full flex-col items-stretch pr-2 sm:items-end sm:pr-3">
            {minutes ? (
              <p className="text-[11px] font-medium leading-relaxed text-white/35">About {minutes} min</p>
            ) : null}
            {showMicrocopyAboveCta ? (
              <p
                className={cn(
                  'max-w-[280px] text-right text-[12px] leading-relaxed text-white/52 sm:max-w-[320px]',
                  minutes ? 'mt-2' : 'mt-0',
                )}
              >
                <PersonalizedRichText
                  text={stripTechnicalTokens(helper) || helper}
                  metricClassName="font-semibold tabular-nums text-[#9CF5EA]/95 [font-variant-numeric:tabular-nums]"
                />
              </p>
            ) : null}
            <Link
              href={safeHref}
              className={cn(
                minutes || showMicrocopyAboveCta ? 'mt-4' : 'mt-2 sm:mt-0',
                heroPrimaryCtaClass({
                  emotionalTone,
                  confidenceBand: band,
                  recoveryVisual,
                }),
              )}
              onClick={onCtaClick}
            >
              {ctaLabel}
            </Link>
            {showMicrocopyBelowCta ? (
              <p className="mt-3.5 max-w-[280px] text-right text-[12px] leading-relaxed text-white/45 sm:max-w-[320px]">
                <PersonalizedRichText
                  text={stripTechnicalTokens(helper) || helper}
                  metricClassName="font-semibold tabular-nums text-[#9CF5EA]/80 [font-variant-numeric:tabular-nums]"
                />
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex max-w-[280px] flex-col items-stretch sm:items-end">
            {showMicrocopyAboveCta ? (
              <p className="text-[12px] font-normal leading-relaxed text-white/45">
                <PersonalizedRichText
                  text={stripTechnicalTokens(helper) || helper}
                  metricClassName="font-semibold tabular-nums text-[#9CF5EA]/90 [font-variant-numeric:tabular-nums]"
                />
              </p>
            ) : null}
            {suppressFallbackTip ? null : (
              <p className="mt-2 text-[12px] font-normal leading-relaxed text-white/38">
                When you’re ready, one deliberate step is enough for today.
              </p>
            )}
          </div>
        )}
      </>
    );
  }

  const {
    title,
    subtitle,
    arcLabel,
    continuityLine,
    whyMatters,
    reassuranceWhisper,
    mode,
    fatigueAdjusted,
    primaryTitleClass,
    compressedVisual,
  } = props;

  const secondary = composeHeroSecondary({ subtitle, arcLabel, continuityLine });
  const why = stripTechnicalTokens(whyMatters?.trim() ?? '') || null;
  const whisper = why || reassuranceWhisper?.trim() || null;

  const recoveryVisual = isRecoveryVisualMode(mode, fatigueAdjusted);
  const metricAccent = cn(
    'font-semibold tabular-nums text-[#9CF5EA] [font-variant-numeric:tabular-nums]',
    recoveryVisual && 'text-[#9CF5EA]/85',
  );
  const metricAccentWhisper = cn(
    'font-semibold tabular-nums text-[#9CF5EA]/90 [font-variant-numeric:tabular-nums]',
    recoveryVisual && 'text-[#9CF5EA]/75',
  );

  const titleDisplay = stripTechnicalTokens(title.trim()) || title.trim();

  const headlineClass = compressedVisual
    ? 'text-[18px] font-semibold leading-snug sm:text-[19px]'
    : primaryTitleClass ?? 'text-[23px] font-semibold sm:text-[27px]';

  return (
    <div className="max-w-[65ch]">
      <h2
        className={cn(
          compressedVisual ? 'mt-5' : 'mt-6',
          'tracking-tight text-white/[0.96]',
          headlineClass,
        )}
      >
        <PersonalizedRichText text={titleDisplay} metricClassName={metricAccent} />
      </h2>
      {secondary ? (
        <p
          className={cn(
            compressedVisual ? 'mt-3.5 text-[13px]' : 'mt-4 text-[14px]',
            'leading-relaxed text-white/58',
            recoveryVisual && 'text-white/52',
          )}
        >
          <PersonalizedRichText text={secondary} metricClassName={metricAccent} />
        </p>
      ) : null}
      {whisper ? (
        <p
          className={cn(
            'text-[12px] font-normal leading-relaxed text-white/40',
            compressedVisual ? 'mt-4' : 'mt-6',
          )}
        >
          <PersonalizedRichText text={whisper} metricClassName={metricAccentWhisper} />
        </p>
      ) : null}
    </div>
  );
}
