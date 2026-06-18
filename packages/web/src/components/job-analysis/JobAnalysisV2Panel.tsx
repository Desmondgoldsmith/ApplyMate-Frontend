'use client';

import type { JobAnalysis } from '@/lib/api';
import {
  ANALYSIS_AXIS_META,
  resolveAnalysisV2Axes,
  resolveAxisTooltips,
} from '@/lib/jobAnalysisV2';

import { AnalysisAxisCard } from '@/components/job-analysis/AnalysisAxisCard';
import { MatchScoreFactorsBreakdown } from '@/components/job-analysis/MatchScoreFactorsBreakdown';
import { ApplyStrategyBlock } from '@/components/job-analysis/ApplyStrategyBlock';
import { AttackPlanPanel } from '@/components/job-analysis/AttackPlanPanel';
import { RecruiterVerdictBadge } from '@/components/job-analysis/RecruiterVerdictBadge';

export function JobAnalysisV2Panel({
  analysis,
  applyUrl,
  isTailored: isTailoredOverride,
  embeddedInReport = false,
  onTailorFirst,
  onApplyNow,
}: {
  analysis: JobAnalysis;
  applyUrl?: string | null;
  /** When true, disables “Tailor first” in the recommended next step block. */
  isTailored?: boolean;
  /**
   * When rendered inside the collapsible AI recruiter report, the score
   * breakdown ("Why this score?") and the apply-strategy / recommended next
   * step block are shown elsewhere on the page, so they are omitted here to
   * avoid duplication.
   */
  embeddedInReport?: boolean;
  onTailorFirst?: () => void;
  onApplyNow?: () => void;
}) {
  const v2 = analysis.analysisV2;
  if (!v2) return null;

  const isTailored =
    isTailoredOverride ??
    Boolean(analysis.isTailored);
  const axisTooltips = resolveAxisTooltips(v2, analysis.factorsBreakdown);
  const displayAxes = resolveAnalysisV2Axes(v2, analysis.factorsBreakdown);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RecruiterVerdictBadge verdict={v2.recruiterVerdict} />
        <p className="text-[11px] text-white/40">
          Overall match {Math.round(analysis.matchScore)}% · recruiter view
        </p>
      </div>

      {!embeddedInReport && analysis.factorsBreakdown?.factors.length ? (
        <MatchScoreFactorsBreakdown
          breakdown={analysis.factorsBreakdown}
          scoreFormulaTooltip={analysis.scoreFormulaTooltip}
          headlineCompositionNote={analysis.headlineCompositionNote}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {ANALYSIS_AXIS_META.map((axis) => {
          const meta = v2.axisMeta?.find((item) => item.key === axis.key);
          return (
            <AnalysisAxisCard
              key={axis.key}
              label={meta?.label ?? axis.label}
              score={displayAxes[axis.key]}
              tooltip={axisTooltips[axis.key]}
            />
          );
        })}
      </div>

      <AttackPlanPanel attackPlan={v2.attackPlan} />

      {!embeddedInReport ? (
        <ApplyStrategyBlock
          strategy={v2.applyStrategy}
          jobListingId={analysis.jobListingId}
          applyUrl={applyUrl}
          isTailored={isTailored}
          onTailorFirst={onTailorFirst}
          onApplyNow={onApplyNow}
        />
      ) : null}
    </div>
  );
}
