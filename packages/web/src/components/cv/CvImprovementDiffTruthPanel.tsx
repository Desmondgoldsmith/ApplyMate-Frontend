'use client';

import { Info, ShieldCheck } from 'lucide-react';

import type { CvPerformanceMeta, CvTruthfulnessMeta } from '@/lib/api';
import {
  shouldShowTruthfulnessAdjustNotice,
  visibleTruthfulnessWarnings,
} from '@/lib/cvTruthfulnessUi';
import { cn } from '@/lib/utils';

const TRANSPARENCY_LINES = [
  'Generated using only information already present in your CV.',
  'No facts or achievements were invented.',
] as const;

type CvImprovementDiffTruthPanelProps = {
  meta: CvTruthfulnessMeta;
  /** Latest apply/materialize telemetry (optional). */
  performance?: CvPerformanceMeta | null;
  className?: string;
};

export function CvImprovementDiffTruthPanel({
  meta,
  performance,
  className,
}: CvImprovementDiffTruthPanelProps) {
  const warnings = visibleTruthfulnessWarnings(meta.truthfulnessWarnings);
  const showAdjustNotice = shouldShowTruthfulnessAdjustNotice(meta);
  const showFactBadge = meta.factualityValidated === true && !showAdjustNotice;
  const unsupported = meta.unsupportedChangesDetected;

  return (
    <div
      className={cn(
        'mb-4 space-y-3 rounded-xl border border-border-subtle bg-bg-surface p-3.5',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Info
            className="mt-0.5 h-4 w-4 shrink-0 text-accent-text"
            aria-hidden
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {TRANSPARENCY_LINES.map((line) => (
              <p
                key={line}
                className="text-[11px] leading-relaxed text-text-tertiary"
              >
                {line}
              </p>
            ))}
          </div>
        </div>
        {showFactBadge ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success-border bg-success-subtle px-2 py-0.5 text-[10px] font-semibold text-success-text">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Fact-checked
          </span>
        ) : null}
      </div>

      {showAdjustNotice ? (
        <div
          role="status"
          className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2.5"
        >
          <p className="text-[11px] font-semibold text-warning-text">
            Some suggested changes were removed or adjusted so they match
            what&apos;s already on your CV.
          </p>
          {typeof unsupported === 'number' && unsupported > 0 ? (
            <p className="mt-1 text-[10px] text-warning-text">
              Unsupported or reverted edits detected: {unsupported}
            </p>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] leading-snug text-warning-text">
              {warnings.map((w, i) => (
                <li key={`${i}-${w.slice(0, 24)}`} className="pl-0.5">
                  {w}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {performance?.cacheHit === true ? (
        <p
          className="text-[10px] leading-relaxed text-text-tertiary"
          data-testid="cv-apply-cache-hit-note"
        >
          Using a previously generated preview.
        </p>
      ) : null}
      {performance &&
      (performance.totalTokenCount !== undefined ||
        performance.promptTokenCount !== undefined ||
        performance.completionTokenCount !== undefined) ? (
        <p
          className="text-[10px] leading-relaxed text-text-tertiary"
          data-testid="cv-ai-telemetry-note"
        >
          Optimized for speed and accuracy.
        </p>
      ) : null}
    </div>
  );
}
