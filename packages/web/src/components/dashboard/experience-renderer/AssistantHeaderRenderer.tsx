'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

import { humanizeReasoningSignal, stripTechnicalTokens } from '@/components/dashboard/assistant-voice';
import { assistantToneStripClass } from '@/components/dashboard/assistant-voice/assistantToneStyles';
import type {
  AdaptiveReasoningPayload,
  AssistantReasoningPayload,
  AssistantStatePayload,
  EmotionalSummaryPayload,
  HumanizedLabelsPayload,
  PersonalizationContextPayload,
} from '@/lib/today-plan';
import { cn } from '@/lib/utils';

function hasAssistantReasoning(ar: AssistantReasoningPayload | null): boolean {
  if (!ar) return false;
  return Boolean(
    ar.primaryFocusReason?.trim() || ar.continuityReason?.trim() || ar.pacingReason?.trim(),
  );
}

const LEVERAGE_ORDER = ['cv_improvement', 'job_matching', 'applications', 'interview_preparation'] as const;

const LEVERAGE_LABELS: Record<(typeof LEVERAGE_ORDER)[number], string> = {
  cv_improvement: 'CV improvement',
  job_matching: 'Job matching',
  applications: 'Applications',
  interview_preparation: 'Interview preparation',
};

function normalizeStrongestLeverage(raw: string): (typeof LEVERAGE_ORDER)[number] | null {
  const x = raw.trim().toLowerCase().replace(/-/g, '_');
  if ((LEVERAGE_ORDER as readonly string[]).includes(x)) return x as (typeof LEVERAGE_ORDER)[number];
  if (x.includes('cv')) return 'cv_improvement';
  if (x.includes('job') && x.includes('match')) return 'job_matching';
  if (x.includes('application')) return 'applications';
  if (x.includes('interview')) return 'interview_preparation';
  return null;
}

export function AssistantHeaderRenderer({
  assistantTone,
  emotionalSummary,
  dailyNarrativeSummary,
  narrativeProgression,
  memorySummary,
  assistantReasoning,
  adaptiveReasoning,
  assistantState: _assistantState,
  humanizedLabels,
  personalizationContext,
  compact,
}: {
  assistantTone: string | null;
  emotionalSummary: EmotionalSummaryPayload | null;
  dailyNarrativeSummary: string | null;
  narrativeProgression: string | null;
  memorySummary: string | null;
  assistantReasoning: AssistantReasoningPayload | null;
  adaptiveReasoning: AdaptiveReasoningPayload[];
  assistantState: AssistantStatePayload | null;
  humanizedLabels: HumanizedLabelsPayload | null;
  personalizationContext?: PersonalizationContextPayload | null;
  compact?: boolean;
}) {
  const [openCompact, setOpenCompact] = useState(false);
  const [openReasoning, setOpenReasoning] = useState(false);
  const [openAdaptive, setOpenAdaptive] = useState(false);

  const assistantVoice = personalizationContext?.assistantVoice ?? null;

  const phase3Primary =
    stripTechnicalTokens(emotionalSummary?.message?.trim() ?? '') ||
    stripTechnicalTokens(assistantVoice?.emotionalSummary?.trim() ?? '') ||
    stripTechnicalTokens(dailyNarrativeSummary?.trim() ?? '') ||
    stripTechnicalTokens(memorySummary?.trim() ?? '') ||
    null;

  const progressionLine =
    stripTechnicalTokens(narrativeProgression?.trim() ?? '') ||
    stripTechnicalTokens(assistantVoice?.narrativeProgression?.trim() ?? '') ||
    null;

  const focusFallback =
    humanizedLabels?.narrativeArc?.trim() || humanizedLabels?.momentum?.trim() || null;

  const fallbackLine = !phase3Primary && !progressionLine ? stripTechnicalTokens(focusFallback ?? '') || null : null;

  const primaryLine = phase3Primary || fallbackLine || null;

  const reasoning = assistantReasoning;
  const hasReasoning = hasAssistantReasoning(reasoning);
  const showAdaptive = adaptiveReasoning.length > 0 && !hasReasoning;

  const leverageRaw = personalizationContext?.strongestLeverage?.trim() ?? '';
  const showLeverageStrip = Boolean(leverageRaw);

  // Compact: only collapsible reasoning / adaptive (no duplicate strip).
  if (compact) {
    if (hasReasoning) {
      return (
        <>
          <HighestImpactAreaStrip
            strongestLeverage={personalizationContext?.strongestLeverage}
            className="mt-4 mb-3"
          />
          <div className={cn('max-w-[640px]', !showLeverageStrip && 'mt-4')}>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#9CF5EA]/55 transition-colors hover:text-[#9CF5EA]/85"
              aria-expanded={openCompact}
              onClick={() => setOpenCompact((v) => !v)}
            >
              Why this?
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openCompact && 'rotate-180')} aria-hidden />
            </button>
            {openCompact ? (
              <AssistantReasoningBody reasoning={reasoning!} />
            ) : null}
          </div>
        </>
      );
    }
    if (showAdaptive) {
      return (
        <>
          <HighestImpactAreaStrip
            strongestLeverage={personalizationContext?.strongestLeverage}
            className="mt-4 mb-3"
          />
          <div className={cn('max-w-[640px]', !showLeverageStrip && 'mt-4')}>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[12px] font-medium text-white/40 transition-colors hover:text-white/60"
              aria-expanded={openAdaptive}
              onClick={() => setOpenAdaptive((v) => !v)}
            >
              Context
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openAdaptive && 'rotate-180')} aria-hidden />
            </button>
            {openAdaptive ? <AdaptiveReasoningBody rows={adaptiveReasoning} /> : null}
          </div>
        </>
      );
    }
    if (showLeverageStrip) {
      return (
        <HighestImpactAreaStrip strongestLeverage={personalizationContext?.strongestLeverage} className="mt-4" />
      );
    }
    return null;
  }

  const hasStrip =
    showLeverageStrip ||
    Boolean(primaryLine || progressionLine) ||
    hasReasoning ||
    showAdaptive;

  if (!hasStrip) return null;

  return (
    <div
      className={cn(
        'mt-4 max-w-[640px] rounded-r-xl border-l py-4 pl-4 pr-3 sm:pl-5',
        assistantToneStripClass(assistantTone),
      )}
    >
      <HighestImpactAreaStrip
        strongestLeverage={personalizationContext?.strongestLeverage}
        className={showLeverageStrip && (primaryLine || progressionLine) ? 'mb-4' : undefined}
      />
      {primaryLine ? (
        <p className="text-[14px] font-medium leading-relaxed text-white/84">{primaryLine}</p>
      ) : null}
      {progressionLine ? (
        <p className={cn('text-[13px] leading-relaxed text-white/52', primaryLine ? 'mt-2' : '')}>
          {progressionLine}
        </p>
      ) : null}
      {hasReasoning ? (
        <div className={primaryLine || progressionLine ? 'mt-4' : ''}>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#9CF5EA]/60 transition-colors hover:text-[#9CF5EA]/90"
            aria-expanded={openReasoning}
            onClick={() => setOpenReasoning((v) => !v)}
          >
            Why this?
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openReasoning && 'rotate-180')} aria-hidden />
          </button>
          {openReasoning && reasoning ? <AssistantReasoningBody reasoning={reasoning} /> : null}
        </div>
      ) : null}

      {showAdaptive ? (
        <div className="mt-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-white/38 transition-colors hover:text-white/55"
            aria-expanded={openAdaptive}
            onClick={() => setOpenAdaptive((v) => !v)}
          >
            Context
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openAdaptive && 'rotate-180')} aria-hidden />
          </button>
          {openAdaptive ? <AdaptiveReasoningBody rows={adaptiveReasoning} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function HighestImpactAreaStrip({
  strongestLeverage,
  className,
}: {
  strongestLeverage: string | null | undefined;
  className?: string;
}) {
  const raw = strongestLeverage?.trim() ?? '';
  if (!raw) return null;
  const activeLeverage = normalizeStrongestLeverage(raw);
  return (
    <div className={cn('max-w-[640px]', className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">Highest impact area</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {LEVERAGE_ORDER.map((key) => (
          <span
            key={key}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none text-white/55',
              activeLeverage === key
                ? 'border-[#00C9B1]/45 bg-[#00C9B1]/12 text-[#B8F5EC]'
                : 'border-white/[0.08] bg-white/[0.03]',
            )}
          >
            {LEVERAGE_LABELS[key]}
          </span>
        ))}
      </div>
    </div>
  );
}

function AssistantReasoningBody({ reasoning }: { reasoning: AssistantReasoningPayload }) {
  const rows: Array<{ label: string; text: string | null }> = [
    { label: 'Focus', text: reasoning.primaryFocusReason?.trim() || null },
    { label: 'Connection', text: reasoning.continuityReason?.trim() || null },
    { label: 'Pacing', text: reasoning.pacingReason?.trim() || null },
  ].filter((x) => x.text);

  return (
    <div className="mt-3 space-y-3 border-l border-white/[0.08] pl-4 text-[13px] leading-relaxed text-white/55">
      {rows.map((r) => (
        <p key={r.label}>
          <span className="font-medium text-white/65">{r.label}. </span>
          {r.text}
        </p>
      ))}
    </div>
  );
}

function AdaptiveReasoningBody({ rows }: { rows: AdaptiveReasoningPayload[] }) {
  return (
    <div className="mt-3 space-y-2.5 border-l border-white/[0.06] pl-3 text-[12px] leading-relaxed text-white/45">
      {rows.slice(0, 6).map((r, i) => {
        const sig = humanizeReasoningSignal(r.signal);
        const eff = r.effect.trim();
        return (
          <p key={`${i}-${eff.slice(0, 40)}`}>
            {sig ? <span className="text-white/55">{sig}: </span> : null}
            {eff}
          </p>
        );
      })}
    </div>
  );
}
