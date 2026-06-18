'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { InfoHint } from '@/components/ui/InfoHint';
import type { JobMatchFactor, JobMatchFactorsBreakdown } from '@/lib/jobMatchFactorsBreakdown';
import {
  factorBarColor,
  factorChipCopy,
  factorMissingExplanationLabel,
  factorTextColor,
  warnFactorScoreInconsistency,
} from '@/lib/jobMatchFactorsBreakdown';
import { cn } from '@/lib/utils';

function FactorChip({ label, tone }: { label: string; tone: 'found' | 'missing' }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full rounded-full border px-2 py-0.5 text-[11px] font-medium leading-snug',
        tone === 'found'
          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
          : 'border-red-400/30 bg-red-500/10 text-red-200',
      )}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Chips bind to API `found` / `missing` only — never parse `explanation`. */
function FactorChips({ factor }: { factor: JobMatchFactor }) {
  if (factor.key !== 'skillsMatch' && factor.key !== 'keywordCoverage') return null;

  const found = factor.found ?? [];
  const missing = factor.missing ?? [];
  const copy = factorChipCopy(factor.key);
  if (found.length === 0 && missing.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {found.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-300/75">
            {copy.foundLabel}
            <span className="ml-1.5 font-normal normal-case tracking-normal text-white/40">
              ({copy.foundCountLabel(found.length)})
            </span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {found.map((label) => (
              <FactorChip key={`found-${label}`} label={label} tone="found" />
            ))}
          </div>
        </div>
      ) : null}
      {missing.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-red-300/75">
            {copy.missingLabel}
            <span className="ml-1.5 font-normal normal-case tracking-normal text-white/40">
              ({copy.missingCountLabel(missing.length)})
            </span>
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {missing.map((label) => (
              <FactorChip key={`missing-${label}`} label={label} tone="missing" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FactorScoreDisplay({ factor }: { factor: JobMatchFactor }) {
  warnFactorScoreInconsistency(factor);
  return (
    <span
      className={cn(
        'shrink-0 text-[12px] font-bold tabular-nums',
        factorTextColor(factor.score),
      )}
    >
      {factor.score}%
    </span>
  );
}

function FactorRow({
  factor,
  isTailored,
}: {
  factor: JobMatchFactor;
  isTailored?: boolean;
}) {
  const barClass = factorBarColor(factor.score);
  const hideKeywordVerbatimNags =
    isTailored === true && factor.key === 'keywordCoverage';
  const divergenceNote = hideKeywordVerbatimNags
    ? ''
    : (factor.missingExplanation?.trim() ?? '');
  const summary = factor.explanation?.trim() ?? '';
  const keywordCounts =
    factor.key === 'keywordCoverage' &&
    factor.totalCount != null &&
    factor.totalCount > 0 &&
    factor.foundCount != null
      ? {
          found: factor.foundCount,
          total: factor.totalCount,
        }
      : null;

  return (
    <li className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-1.5">
          <span className="block text-[12px] font-semibold text-white/88">{factor.label}</span>
          {factor.hint ? (
            <InfoHint
              text={factor.hint}
              buttonAriaLabel={`What ${factor.label} means`}
              className="mt-0.5 shrink-0"
            />
          ) : null}
        </div>
        <FactorScoreDisplay factor={factor} />
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', barClass)}
          style={{ width: `${factor.score}%` }}
          role="progressbar"
          aria-valuenow={factor.score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${factor.label} ${factor.score}%`}
        />
      </div>
      {keywordCounts ? (
        <div className="space-y-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/45">
              Exact job description phrases on your CV
            </p>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/60">
              {keywordCounts.found} of {keywordCounts.total}
            </span>
          </div>
        </div>
      ) : null}
      <FactorChips factor={factor} />
      {summary ? (
        <p className="text-[11px] leading-relaxed text-white/55">{summary}</p>
      ) : null}
      {divergenceNote ? (
        <div className="mt-1 space-y-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/40">
            {factorMissingExplanationLabel(factor.key)}
          </p>
          <p className="text-[11px] leading-relaxed text-white/52">{divergenceNote}</p>
        </div>
      ) : null}
    </li>
  );
}

export type MatchScoreFactorsBreakdownProps = {
  breakdown: JobMatchFactorsBreakdown;
  className?: string;
  /** Start expanded (e.g. on the Job Analyzer results panel). */
  defaultOpen?: boolean;
  /** Server-authored formula copy for the score explanation tooltip. */
  scoreFormulaTooltip?: string | null;
  /** Clarifies headline 50/30/20 weighting vs diagnostic factors. */
  headlineCompositionNote?: string | null;
  /** When true, omit verbatim keyword gap nags (post-tailor API omits them). */
  isTailored?: boolean;
};

const DEFAULT_SCORE_FORMULA_TOOLTIP =
  'Match score = 50% skills evidence + 30% years of experience + 20% seniority level. Skills evidence counts requirements where your CV shows real proof, not keyword mentions alone.';

/** Expandable factor rows under the headline job match score (3.3). */
export function MatchScoreFactorsBreakdown({
  breakdown,
  className,
  defaultOpen = false,
  scoreFormulaTooltip,
  headlineCompositionNote,
  isTailored = false,
}: MatchScoreFactorsBreakdownProps) {
  const [open, setOpen] = useState(defaultOpen);
  const factors = breakdown.factors;
  if (factors.length === 0) return null;
  const formulaTooltip = scoreFormulaTooltip?.trim() || DEFAULT_SCORE_FORMULA_TOOLTIP;
  const compositionNote = headlineCompositionNote?.trim() ?? '';

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-1.5 rounded-lg py-1 text-left text-[12px] font-medium text-white/50 transition hover:text-[#00C9B1]"
        >
          <ChevronDown
            className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
          Why this score?
        </button>
        <InfoHint
          text={formulaTooltip}
          buttonAriaLabel="How match score is calculated"
          className="shrink-0"
        />
      </div>
      {compositionNote ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/42">{compositionNote}</p>
      ) : null}
      {open ? (
        <ul className="mt-2 space-y-2.5" aria-label="Match score breakdown">
          {factors.map((factor) => (
            <FactorRow key={factor.key} factor={factor} isTailored={isTailored} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
