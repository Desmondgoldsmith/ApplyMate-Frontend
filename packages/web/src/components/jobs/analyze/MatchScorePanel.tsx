'use client';

import { JobAnalysisCard } from '@/components/dashboard/JobAnalysisCard';
import { InterviewReadinessSection } from '@/components/job-analysis/InterviewReadinessSection';
import { ScoreImprovementGuideCard } from '@/components/job-analysis/ScoreImprovementGuideCard';
import { AiRecruiterReportSection } from '@/components/job-analysis/AiRecruiterReportSection';
import type { JobAnalysis } from '@/lib/api';
import { shouldShowScoreImprovementGuide } from '@/lib/scoreImprovement';
import { displayScoreBeforeTailorForAnalysis } from '@/lib/tailorAnalysisUi';

export type MatchScorePanelProps = {
  analysis: JobAnalysis;
  rematching: boolean;
  displayScoreBeforeTailor: number | null;
  isTailorComplete: boolean;
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
  isTailorComplete,
  acceptedSkillNames,
  resolvedApplyUrl,
  analyzePending,
  aiReportPending,
  onTailorFirst,
  onApplyNow,
}: MatchScorePanelProps) {
  const scoreBefore = displayScoreBeforeTailorForAnalysis(analysis, displayScoreBeforeTailor);

  return (
    <>
      <JobAnalysisCard
        key={analysis.id}
        analysis={analysis}
        hideAiReport
        rematchInProgress={rematching}
        scoreBeforeTailor={scoreBefore}
        isTailored={isTailorComplete}
        acceptedSkillNames={acceptedSkillNames}
        applyUrl={resolvedApplyUrl}
        onTailorFirst={onTailorFirst}
        onApplyNow={onApplyNow}
        factorsDefaultOpen
      />
      {shouldShowScoreImprovementGuide(analysis.scoreImprovement) ? (
        <ScoreImprovementGuideCard
          guide={analysis.scoreImprovement!}
          readinessNote={analysis.interviewReadinessNote}
        />
      ) : analysis.interviewReadinessNote ? (
        <InterviewReadinessSection note={analysis.interviewReadinessNote} />
      ) : null}
      <AiRecruiterReportSection
        analysis={analysis}
        loading={analyzePending || aiReportPending}
        applyUrl={resolvedApplyUrl}
        isTailored={isTailorComplete}
        onTailorFirst={onTailorFirst}
        onApplyNow={onApplyNow}
      />
    </>
  );
}
