'use client';

import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

import { JobAnalysisV2Panel } from '@/components/job-analysis/JobAnalysisV2Panel';
import { cn } from '@/lib/utils';
import type { JobAnalysis } from '@/lib/api';

export function AiRecruiterReportSection({
  analysis,
  loading,
  defaultOpen = false,
  applyUrl,
  isTailored = false,
  onTailorFirst,
  onApplyNow,
}: {
  analysis: JobAnalysis | null;
  loading?: boolean;
  defaultOpen?: boolean;
  applyUrl?: string | null;
  isTailored?: boolean;
  onTailorFirst?: () => void;
  onApplyNow?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const analysisId = analysis?.id?.trim();
  const hasReport = Boolean(analysis?.analysisV2);
  const showGlow = hasReport || loading || Boolean(analysisId);

  useEffect(() => {
    if (hasReport && !loading) setOpen(false);
  }, [hasReport, loading]);

  if (!hasReport && !loading && !analysisId) return null;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border',
        showGlow
          ? 'border-[#00C9B1]/35 shadow-[0_0_28px_rgba(0,201,177,0.12)]'
          : 'border-white/[0.08]',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition',
          showGlow && 'animate-[pulse_2.4s_ease-in-out_infinite] bg-[#00C9B1]/[0.06]',
          !showGlow && 'bg-white/[0.03]',
        )}
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
              showGlow
                ? 'border-[#00C9B1]/40 bg-[#00C9B1]/15 text-[#00C9B1]'
                : 'border-white/12 bg-white/[0.04] text-white/45',
            )}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            )}
          </span>
          <div>
            <p className="text-sm font-semibold text-white">AI recruiter report</p>
            <p className="text-[11px] text-white/45">
              {loading
                ? 'Generating deep analysis…'
                : hasReport
                  ? 'Verdict, axes, and attack plan — expand to review'
                  : 'Report missing for this save — expand for details'}
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-white/45 transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
          {analysis?.analysisV2 ? (
            <JobAnalysisV2Panel
              analysis={analysis}
              applyUrl={applyUrl}
              isTailored={isTailored}
              onTailorFirst={onTailorFirst}
              onApplyNow={onApplyNow}
            />
          ) : (
            <p className="text-sm text-white/50">
              No deep recruiter report is stored for this analysis yet. Re-run analysis from the Job Analyzer to
              generate verdict, axes, and an attack plan.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

