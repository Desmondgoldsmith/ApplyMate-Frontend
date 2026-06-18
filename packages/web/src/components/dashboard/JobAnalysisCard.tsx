import { Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { AtsRiskPanel } from '@/components/job-analysis/AtsRiskPanel';
import { JobAnalysisV2Panel } from '@/components/job-analysis/JobAnalysisV2Panel';
import { LocationEligibilityCallout } from '@/components/job-analysis/LocationEligibilityCallout';
import { MatchScoreFactorsBreakdown } from '@/components/job-analysis/MatchScoreFactorsBreakdown';
import { PresentationGapsPanel } from '@/components/job-analysis/PresentationGapsPanel';
import { JobSalaryEstimatePanel } from '@/components/job-analysis/JobSalaryEstimatePanel';
import { SkillTierBadge } from '@/components/job-analysis/SkillTierBadge';
import { RequirementKindBadge } from '@/components/job-analysis/RequirementKindBadge';
import { Button } from '@/components/ui/Button';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { MatchScoreBar } from '@/components/ui/MatchScoreBar';

import type { JobAnalysis } from '@/lib/api';
import { resolveAtsRiskItems } from '@/lib/jobAnalysisAts';
import { getGapDisplaySkills } from '@/lib/skillCoverage';
import { effectiveIsTailoredForAnalysis } from '@/lib/tailorAnalysisUi';
import { cn } from '@/lib/utils';

export function JobAnalysisCard({
  analysis,
  rematchInProgress,
  scoreBeforeTailor,
  isTailored,
  acceptedSkillNames,
  showTailorAction = false,
  hideAiReport = false,
  factorsDefaultOpen = false,
  applyUrl,
  onTailorFirst,
  onApplyNow,
}: {
  analysis: JobAnalysis;
  rematchInProgress?: boolean;
  scoreBeforeTailor?: number | null;
  isTailored?: boolean;
  acceptedSkillNames?: string[];
  showTailorAction?: boolean;
  /** When true, AI recruiter report is shown in a parent collapsible section instead. */
  hideAiReport?: boolean;
  /** Expand the "Why this score?" factor breakdown by default (Job Analyzer results panel). */
  factorsDefaultOpen?: boolean;
  applyUrl?: string | null;
  onTailorFirst?: () => void;
  onApplyNow?: () => void;
}) {
  const router = useRouter();
  const acceptedLower = useMemo(
    () =>
      new Set(
        (acceptedSkillNames ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean),
      ),
    [acceptedSkillNames],
  );

  const resolvedTailoredForScore = useMemo(
    () =>
      isTailored != null
        ? Boolean(isTailored)
        : effectiveIsTailoredForAnalysis(analysis),
    [analysis, isTailored],
  );

  const gapSkills = useMemo(() => getGapDisplaySkills(analysis), [analysis]);

  const skillsAddedToCv = useMemo(() => {
    if (!resolvedTailoredForScore) return [];
    const fromApi = analysis.skillsAddedToCv ?? [];
    if (fromApi.length > 0) return fromApi;
    return [];
  }, [analysis.skillsAddedToCv, resolvedTailoredForScore]);

  const atsRiskItems = useMemo(() => {
    if (resolvedTailoredForScore) return [];
    return resolveAtsRiskItems(analysis);
  }, [analysis, resolvedTailoredForScore]);

  const salary = analysis.salaryEstimate;
  const cvMeta = analysis as JobAnalysis & {
    cvProfileId?: string | null;
    sourceCvProfileId?: string | null;
    tailoredCvProfileId?: string | null;
  };
  const preferredCvProfileId = (
    cvMeta.tailoredCvProfileId ??
    cvMeta.sourceCvProfileId ??
    cvMeta.cvProfileId ??
    ''
  ).trim();
  const analyzedCvProfileId = (cvMeta.sourceCvProfileId ?? cvMeta.cvProfileId ?? '').trim();
  const fallbackCvProfileId = (cvMeta.cvProfileId ?? '').trim();
  const hasV2 = Boolean(analysis.analysisV2);
  const factorsBreakdown = analysis.factorsBreakdown;
  const headerCompany = (analysis.company ?? '').trim() || 'Company';
  const headerTitle = (analysis.title ?? '').trim();

  return (
    <div className="relative min-w-0 max-w-full space-y-6 overflow-x-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-6">
      {headerTitle || headerCompany !== 'Company' ? (
        <div className="flex items-start gap-3 border-b border-white/[0.06] pb-4">
          <CompanyLogo
            company={headerCompany}
            logoUrl={analysis.companyLogoUrl}
            size="lg"
            shape="rounded"
          />
          <div className="min-w-0">
            {headerTitle ? (
              <p className="text-base font-semibold leading-snug text-white sm:text-lg">{headerTitle}</p>
            ) : null}
            <p className={cn('text-[13px] text-white/55', headerTitle && 'mt-0.5')}>{headerCompany}</p>
          </div>
        </div>
      ) : null}
      {rematchInProgress ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#0C0F0F]/88 backdrop-blur-[2px]"
          aria-live="polite"
          aria-busy="true"
        >
          <Loader2 className="h-8 w-8 animate-spin text-[#00C9B1]" strokeWidth={2} />
          <p className="text-sm font-medium text-white/80">Updating match…</p>
        </div>
      ) : null}
      {analysis.locationEligibility ? (
        <LocationEligibilityCallout eligibility={analysis.locationEligibility} />
      ) : null}
      {hasV2 && !hideAiReport ? (
        <JobAnalysisV2Panel
          analysis={analysis}
          applyUrl={applyUrl}
          onTailorFirst={onTailorFirst}
          onApplyNow={onApplyNow}
        />
      ) : !hasV2 || hideAiReport ? (
        <>
          <MatchScoreBar
            key={`sb-${analysis.id}-${scoreBeforeTailor ?? 'n'}-${analysis.matchScore}-${String(resolvedTailoredForScore)}`}
            score={analysis.matchScore}
            label={
              analysis.scoreSource === 'heuristic'
                ? 'Estimated match'
                : analysis.scoreSource === 'ai'
                  ? 'AI analyzed'
                  : 'Match score'
            }
            isTailored={resolvedTailoredForScore}
            scoreBeforeTailor={scoreBeforeTailor ?? null}
            matchScoreBenchmark={analysis.matchScoreBenchmark}
            scoreFormulaTooltip={analysis.scoreFormulaTooltip}
            headlineCompositionNote={analysis.headlineCompositionNote}
          />
          {resolvedTailoredForScore ? (
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">
              Scores reflect your tailored CV for this role.
            </p>
          ) : null}
          {analysis.scoreSource === 'heuristic' ? (
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              Quick estimate only. Use Job Analyzer for a full AI gap review and tailoring list.
            </p>
          ) : analysis.scoreSource === 'ai' ? (
            <p className="mt-2 text-[11px] leading-relaxed text-emerald-200/65">
              AI-analyzed: skill gaps below are suitable for tailoring.
            </p>
          ) : null}
          {factorsBreakdown?.factors.length ? (
            <MatchScoreFactorsBreakdown
              breakdown={factorsBreakdown}
              className="mt-3"
              defaultOpen={factorsDefaultOpen}
              scoreFormulaTooltip={analysis.scoreFormulaTooltip}
              headlineCompositionNote={analysis.headlineCompositionNote}
              isTailored={resolvedTailoredForScore}
            />
          ) : null}
          {!resolvedTailoredForScore && atsRiskItems.length > 0 ? (
            <AtsRiskPanel items={atsRiskItems} className="mt-3" />
          ) : null}
        </>
      ) : null}
      {analysis.id && typeof analysis.matchScore === 'number' && Number.isFinite(analysis.matchScore) ? (
        <div className="flex min-w-0 flex-wrap justify-start gap-2">
          {showTailorAction && !resolvedTailoredForScore ? (
            <Button
              variant="ghost"
              className="min-h-[44px] gap-2 rounded-[10px] border border-[#00C9B1]/40 px-5 text-[13px] font-medium text-[#00C9B1] transition hover:border-[#00C9B1] hover:bg-[#00C9B1]/12"
              onClick={() =>
                router.push(`/dashboard/jobs/analyze?jobId=${encodeURIComponent(analysis.id!)}&openTailor=1`)
              }
            >
              Tailor CV for this job
            </Button>
          ) : null}
        </div>
      ) : null}

      {salary && !rematchInProgress ? (
        <JobSalaryEstimatePanel estimate={salary} />
      ) : null}

      <div>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
          {resolvedTailoredForScore
            ? 'Skills added to your CV'
            : analysis.scoreSource === 'heuristic'
              ? 'Gaps to address (estimate)'
              : 'Gaps to address'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {resolvedTailoredForScore
            ? skillsAddedToCv.length > 0
              ? skillsAddedToCv.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-[12px] font-medium text-emerald-200"
                  >
                    {skill}
                    <span className="ml-1.5 text-[10px] font-semibold text-emerald-300/90">Added</span>
                  </span>
                ))
              : (
                  <p className="text-[12px] leading-relaxed text-white/45">
                    No additional skills were added during tailoring.
                  </p>
                )
            : gapSkills.map((skill) => {
            const accepted =
              resolvedTailoredForScore || acceptedLower.has(skill.name.trim().toLowerCase());
            if (accepted) {
              return (
                <span
                  key={skill.name}
                  className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-[12px] font-medium text-emerald-200"
                >
                  {skill.name}
                  <span className="ml-1.5 text-[10px] font-semibold text-emerald-300/90">
                    {resolvedTailoredForScore ? 'Added' : '✓'}
                  </span>
                </span>
              );
            }
            return (
              <span
                key={skill.name}
                title={`${skill.name} (${skill.importance})`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3.5 py-1.5 text-[12px] font-medium text-[rgba(239,68,68,0.92)]"
              >
                {skill.name}
                <SkillTierBadge tier={skill.tier} />
                {skill.requirementKind ? (
                  <RequirementKindBadge kind={skill.requirementKind} />
                ) : null}
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
                  {skill.importance}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {!resolvedTailoredForScore && analysis.presentationGaps?.length ? (
        <PresentationGapsPanel gaps={analysis.presentationGaps} />
      ) : null}

      <div>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">Your strengths</h3>
        <ul className="flex flex-col gap-1.5">
          {(analysis.strengths ?? []).map((strength) => (
            <li
              key={strength}
              className="flex gap-3 rounded-lg border-l-2 border-[rgba(16,185,129,0.3)] bg-[rgba(16,185,129,0.04)] px-3.5 py-2.5 text-[13px] leading-snug text-white/80"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#10B981]" strokeWidth={2.5} aria-hidden />
              <span>{strength}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
