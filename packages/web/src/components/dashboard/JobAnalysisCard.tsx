import { Check, CircleDollarSign, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { JobAnalysisV2Panel } from '@/components/job-analysis/JobAnalysisV2Panel';
import { Button } from '@/components/ui/Button';
import { MatchScoreBar } from '@/components/ui/MatchScoreBar';

import type { JobAnalysis, JobSalaryEstimate } from '@/lib/api';

function localeForSalaryCurrency(code: string): string {
  const c = code.toUpperCase();
  if (c === 'GHS') return 'en-GH';
  if (c === 'NGN') return 'en-NG';
  if (c === 'KES') return 'en-KE';
  if (c === 'ZAR') return 'en-ZA';
  if (c === 'EGP') return 'en-EG';
  if (c === 'GBP') return 'en-GB';
  return 'en-US';
}

function formatSalaryAmount(n: number, currency: string): string {
  const loc = localeForSalaryCurrency(currency);
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: currency.toUpperCase(),
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString(loc)}`;
  }
}

function formatSalaryRange(est: JobSalaryEstimate): string {
  const a = formatSalaryAmount(est.min, est.currency);
  const b = formatSalaryAmount(est.max, est.currency);
  const basis =
    est.basis?.toLowerCase() === 'annual' || !est.basis ? 'year' : String(est.basis).replace(/_/g, ' ');
  return `${a} – ${b} / ${basis}`;
}

function SalaryConfidenceLine({ est }: { est: JobSalaryEstimate }) {
  const c = est.confidence;
  if (c === 'high') {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-200/95">
        High confidence
      </span>
    );
  }
  if (c === 'low') {
    return (
      <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-white/45">
        Rough estimate
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-amber-500/35 bg-[rgba(245,158,11,0.15)] px-2.5 py-0.5 text-[11px] font-semibold text-amber-100/95">
      ~ Estimated
    </span>
  );
}

export function JobAnalysisCard({
  analysis,
  rematchInProgress,
  scoreBeforeTailor,
  isTailored,
  acceptedSkillNames,
  showTailorAction = false,
  hideAiReport = false,
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

  const skillBarSkills = (analysis.missingSkills ?? []).slice(0, 6).map((skill) => ({
    name: skill.name,
    matched: acceptedLower.has(skill.name.trim().toLowerCase()),
  }));

  const resolvedTailoredForScore = Boolean(isTailored || analysis.isTailored);

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

  return (
    <div className="relative min-w-0 max-w-full space-y-6 overflow-x-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-6">
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
                  ? 'AI match'
                  : 'Match score'
            }
            isTailored={resolvedTailoredForScore}
            scoreBeforeTailor={scoreBeforeTailor ?? null}
            skills={skillBarSkills}
          />
          {analysis.scoreSource === 'heuristic' ? (
            <p className="mt-2 text-[11px] leading-relaxed text-white/40">
              Quick estimate only. Use Job Analyzer for a full AI gap review and tailoring list.
            </p>
          ) : analysis.scoreSource === 'ai' ? (
            <p className="mt-2 text-[11px] leading-relaxed text-emerald-200/65">
              AI-analyzed — skill gaps below are suitable for tailoring.
            </p>
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
        <div className="rounded-[14px] border border-amber-500/20 bg-[rgba(245,158,11,0.06)] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <CircleDollarSign className="h-5 w-5 shrink-0 text-amber-300" strokeWidth={2} aria-hidden />
            <p className="text-[14px] font-semibold text-white">Estimated Salary</p>
          </div>
          <p className="mt-2 text-[22px] font-bold leading-tight text-white">{formatSalaryRange(salary)}</p>
          <div className="mt-2">
            <SalaryConfidenceLine est={salary} />
          </div>
          {salary.note?.trim() ? (
            <p className="mt-3 text-[12px] leading-relaxed text-white/45">{salary.note.trim()}</p>
          ) : null}
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">
          {resolvedTailoredForScore
            ? 'Skills added to your CV'
            : analysis.scoreSource === 'heuristic'
              ? 'Skill gaps (estimate)'
              : 'Skills to highlight'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {(analysis.missingSkills ?? []).map((skill) => {
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
                className="inline-flex items-center rounded-full border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3.5 py-1.5 text-[12px] font-medium text-[rgba(239,68,68,0.92)]"
              >
                {skill.name}
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                  {skill.importance}
                </span>
              </span>
            );
          })}
        </div>
      </div>

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
