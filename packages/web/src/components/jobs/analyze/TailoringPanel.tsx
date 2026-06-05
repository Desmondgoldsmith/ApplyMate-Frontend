'use client';

import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { JobAnalysis } from '@/lib/api';
import { cn } from '@/lib/utils';

export type TailoringPanelProps = {
  analysis: JobAnalysis;
  tailorSectionComplete: boolean;
  displayScoreBeforeTailor: number | null;
  hasTailorDraftForJob: boolean;
  rematching: boolean;
  analyzePending: boolean;
  onOpenTailorPanel: () => void;
  onRematch: () => void;
};

/** Post-tailor summary and actions (view CV, refresh match score). */
export function TailoringPanel({
  analysis,
  tailorSectionComplete,
  displayScoreBeforeTailor,
  hasTailorDraftForJob,
  rematching,
  analyzePending,
  onOpenTailorPanel,
  onRematch,
}: TailoringPanelProps) {
  const missingSkills = analysis.missingSkills ?? [];

  if (!tailorSectionComplete || missingSkills.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[rgba(0,201,177,0.25)] bg-[rgba(0,201,177,0.05)] px-4 py-3.5">
        <span className="mt-0.5 text-[#00C9B1]" aria-hidden>
          ✓
        </span>
        <div>
          <p className="text-sm font-semibold text-[#F0F4F2]">
            CV tailored for this role
          </p>
          <p className="mt-1 text-xs text-white/50">
            Changes are saved on your CV.
            {hasTailorDraftForJob
              ? ' Open the panel to review before/after sections and export.'
              : ' If section details don’t load, use Refresh match score — your tailored CV is still on file.'}
          </p>
          {displayScoreBeforeTailor != null &&
          Number.isFinite(displayScoreBeforeTailor) ? (
            <p
              className={cn(
                'mt-2 text-xs',
                analysis.matchScore > displayScoreBeforeTailor
                  ? 'text-emerald-200/90'
                  : analysis.matchScore === displayScoreBeforeTailor
                    ? 'text-white/45'
                    : 'text-amber-200/85',
              )}
            >
              Job fit: {Math.round(displayScoreBeforeTailor)}% →{' '}
              {Math.round(analysis.matchScore)}
              {analysis.matchScore === displayScoreBeforeTailor
                ? ' (no change)'
                : ''}
            </p>
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        fullWidth
        className="gap-2"
        onClick={onOpenTailorPanel}
      >
        <span className="text-base leading-none" aria-hidden>
          ✦
        </span>
        View tailored CV & changes
      </Button>
      <Button
        type="button"
        variant="ghost"
        fullWidth
        className="mt-2 gap-2"
        disabled={rematching || analyzePending}
        onClick={onRematch}
      >
        {rematching ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Refreshing match…
          </>
        ) : (
          'Refresh match score'
        )}
      </Button>
    </>
  );
}
