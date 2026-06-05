'use client';

import { JobAnalysisCard } from '@/components/dashboard/JobAnalysisCard';
import { ScoreImprovementGuideCard } from '@/components/job-analysis/ScoreImprovementGuideCard';
import { AiRecruiterReportSection } from '@/components/job-analysis/AiRecruiterReportSection';
import type { JobAnalysis } from '@/lib/api';
import { shouldShowScoreImprovementGuide } from '@/lib/scoreImprovement';

export type MatchScorePanelProps = {
  analysis: JobAnalysis;
  rematching: boolean;
  displayScoreBeforeTailor: number | null;
  tailorSectionComplete: boolean;
  acceptedSkillNames: string[];
  resolvedApplyUrl: string | null | undefined;
  analyzePending: boolean;
  aiReportPending: boolean;
  onTailorFirst: () => void;
  onApplyNow: () => void;
};

/** Match score ring, improvement guide, and AI recruiter report for a completed analysis. */
export function MatchScorePanel({
  analysis,
  rematching,
  displayScoreBeforeTailor,
  tailorSectionComplete,
  acceptedSkillNames,
  resolvedApplyUrl,
  analyzePending,
  aiReportPending,
  onTailorFirst,
  onApplyNow,
}: MatchScorePanelProps) {
  return (
    <>
      <JobAnalysisCard
        key={analysis.id}
        analysis={analysis}
        hideAiReport
        rematchInProgress={rematching}
        scoreBeforeTailor={displayScoreBeforeTailor}
        isTailored={tailorSectionComplete}
        acceptedSkillNames={acceptedSkillNames}
        applyUrl={resolvedApplyUrl}
        onTailorFirst={onTailorFirst}
        onApplyNow={onApplyNow}
      />
      {shouldShowScoreImprovementGuide(analysis.scoreImprovement) ? (
        <ScoreImprovementGuideCard guide={analysis.scoreImprovement!} />
      ) : null}
      <AiRecruiterReportSection
        analysis={analysis}
        loading={analyzePending || aiReportPending}
        applyUrl={resolvedApplyUrl}
        isTailored={tailorSectionComplete}
        onTailorFirst={onTailorFirst}
        onApplyNow={onApplyNow}
      />
    </>
  );
}
