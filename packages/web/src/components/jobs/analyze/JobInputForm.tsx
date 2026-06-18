'use client';

import { Loader2, Search } from 'lucide-react';
import { useState } from 'react';

import { JobInputFormField } from '@/components/jobs/analyze/JobInputFormField';
import { Button } from '@/components/ui/Button';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { useJobHistory } from '@/hooks/useJobHistory';
import type { CvProfileSummary, JobHistoryItem } from '@/lib/api';
import { AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS } from '@/lib/ai-prompt-input.limits';
import {
  formatJobDescriptionCharCount,
  isJobDescriptionOverAiLimit,
} from '@/lib/aiPromptInputDisplay';
import { ensureArray } from '@/lib/ensure-array';
import { cn } from '@/lib/utils';

export type JobInputFormProps = {
  title: string;
  company: string;
  description: string;
  descriptionWordCount: number;
  error: string | null;
  cvProfiles: CvProfileSummary[];
  selectedProfileId: string | null;
  selectedProfile: CvProfileSummary | null;
  onTitleChange: (value: string) => void;
  onCompanyChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSelectedProfileChange: (profileId: string | null) => void;
  onClearForm: () => void;
  onSubmit: () => void;
  analyzePending: boolean;
  aiReportPending: boolean;
  analyzeProgressLabel?: string;
  viewingSavedAnalysis: boolean;
  /** When true, primary CTA labels full re-analyze (post-tailor sync uses API scores). */
  analysisIsTailored?: boolean;
  activeAnalysisId: string | undefined;
  onSelectHistoryJob: (jobId: string) => Promise<unknown>;
  /** Extra classes for the header + CV selector + form group (used by the mobile tab switch). */
  analyzeClassName?: string;
  /** Extra classes for the recent-analyses group (used by the mobile tab switch). */
  historyClassName?: string;
};

/** Left column: CV picker, job fields, analyze CTA, and recent analyses (self-fetches history). */
export function JobInputForm({
  title,
  company,
  description,
  descriptionWordCount,
  error,
  cvProfiles,
  selectedProfileId,
  selectedProfile,
  onTitleChange,
  onCompanyChange,
  onDescriptionChange,
  onSelectedProfileChange,
  onClearForm,
  onSubmit,
  analyzePending,
  aiReportPending,
  analyzeProgressLabel,
  viewingSavedAnalysis,
  analysisIsTailored = false,
  activeAnalysisId,
  onSelectHistoryJob,
  analyzeClassName,
  historyClassName,
}: JobInputFormProps) {
  const history = useJobHistory();
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);

  const overAiLimit = isJobDescriptionOverAiLimit(description.length);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className={cn('flex min-w-0 flex-col gap-5', analyzeClassName)}>
      <header className="min-w-0">
        <h1 className="text-[20px] font-bold leading-tight text-[#F0F4F2]">
          Job Analyzer
        </h1>
        <p className="mt-0.5 text-[13px] leading-relaxed text-white/60">
          Paste any job and see how well your CV fits.
        </p>
      </header>

      {cvProfiles.length > 1 ? (
        <section className="min-w-0 rounded-2xl border border-white/[0.06] bg-[#0F1512] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/35">
            Matching against
          </p>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="relative min-w-0 flex-1">
              <select
                className="h-10 w-full min-w-0 appearance-none rounded-xl border border-white/[0.1] bg-[#141C18] px-3.5 pr-9 text-[13px] text-[#F0F4F2] outline-none transition-colors [color-scheme:dark] focus:border-[rgba(0,201,177,0.45)] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.08)]"
                value={selectedProfileId ?? ''}
                onChange={(e) => onSelectedProfileChange(e.target.value || null)}
              >
                {cvProfiles.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    className="bg-[#141C18] text-white"
                  >
                    {p.name}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {selectedProfile ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold tabular-nums',
                  selectedProfile.score == null
                    ? 'border-white/12 text-white/45'
                    : selectedProfile.score >= 70
                      ? 'border-[#00C9B1]/30 bg-[rgba(0,201,177,0.1)] text-[#00C9B1]'
                      : selectedProfile.score >= 40
                        ? 'border-amber-500/30 bg-[rgba(245,158,11,0.1)] text-[#F59E0B]'
                        : 'border-rose-500/30 bg-[rgba(248,113,113,0.1)] text-[#F87171]',
                )}
              >
                {selectedProfile.score !== null
                  ? `${selectedProfile.score}/100`
                  : '—'}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 truncate text-[11px] text-white/35">
            Job fit uses your structured CV. CV quality is separate from role
            match %.
            {selectedProfile?.isDefault ? (
              <span className="ml-1 font-medium text-[#00C9B1]">Default CV</span>
            ) : null}
          </p>
        </section>
      ) : null}

      <section className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[#F0F4F2]">
            Analyze a Job
          </h2>
          <button
            type="button"
            onClick={onClearForm}
            className="text-[12px] font-medium text-white/35 transition-colors hover:text-white/60"
          >
            Clear form
          </button>
        </div>

        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <JobInputFormField
            label="Job title"
            value={title}
            onChange={onTitleChange}
            placeholder="e.g. Senior Frontend Engineer"
          />
          <JobInputFormField
            label="Company"
            value={company}
            onChange={onCompanyChange}
            placeholder="e.g. Acme Inc."
          />
        </div>

        <div className="mt-3">
          <label
            className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.06em] text-white/35"
            htmlFor="analyze-jd"
          >
            Job description
          </label>
          <div className="relative">
            <textarea
              id="analyze-jd"
              className={cn(
                'min-h-[140px] max-h-[280px] w-full min-w-0 resize-y rounded-xl border bg-[#0F1512] px-3 py-3 pb-7 text-[13px] leading-[1.6] text-[#F0F4F2] outline-none transition-colors duration-150 placeholder:text-white/30 focus:shadow-[0_0_0_3px_rgba(0,201,177,0.08)]',
                overAiLimit
                  ? 'border-rose-400/40 focus:border-rose-400/50'
                  : 'border-white/[0.1] focus:border-[rgba(0,201,177,0.45)]',
              )}
              placeholder="Paste the full job description here..."
              value={description}
              maxLength={AI_PROMPT_INPUT_JOB_DESCRIPTION_MAX_CHARS}
              onChange={(e) => onDescriptionChange(e.target.value)}
            />
            <span
              className={cn(
                'pointer-events-none absolute bottom-2 right-3 text-[11px]',
                overAiLimit ? 'text-rose-400/80' : 'text-white/35',
              )}
            >
              {descriptionWordCount} words ·{' '}
              {formatJobDescriptionCharCount(description.length)}
            </span>
          </div>
        </div>

        {error ? <p className="mt-2 text-[12px] text-red-300">{error}</p> : null}

        <Button
          fullWidth
          variant="primary"
          onClick={onSubmit}
          disabled={
            analyzePending || (cvProfiles.length > 1 && !selectedProfileId)
          }
          className="mt-3.5 hidden min-h-[48px] rounded-xl bg-[#00C9B1] text-[14px] font-bold tracking-[0.01em] text-[#080B0A] shadow-[0_6px_24px_rgba(0,201,177,0.28)] transition hover:brightness-[1.08] active:scale-[0.99] lg:flex"
        >
          {analyzePending || aiReportPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
              {analyzeProgressLabel?.trim() ||
                (aiReportPending ? 'Running AI report…' : 'Analyzing…')}
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              {viewingSavedAnalysis
                ? analysisIsTailored
                  ? 'Re-analyze job (full AI)'
                  : 'Refresh analysis'
                : 'Analyze job'}
            </>
          )}
        </Button>
        <p className="mt-1.5 text-center text-[11px] leading-relaxed text-white/35">
          Runs match scoring and your AI recruiter report (when quota allows).
          The report opens collapsed below with a glowing header.
        </p>
      </section>
      </div>

      <section
        className={cn('min-w-0', historyClassName)}
        data-tour="analyzer-history"
      >
        <p className="mb-2.5 text-[13px] font-semibold text-[#F0F4F2]">
          Recent analyses
        </p>
          <div className="flex flex-col gap-1.5">
            {ensureArray<JobHistoryItem>(history.data)
              .slice(0, 3)
              .map((item) => {
                const active = activeAnalysisId === item.id;
                const sc = item.matchScore;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={historyLoadingId === item.id}
                    onClick={async () => {
                      setHistoryLoadingId(item.id);
                      try {
                        await onSelectHistoryJob(item.id);
                      } finally {
                        setHistoryLoadingId(null);
                      }
                    }}
                    className={cn(
                      'flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-150',
                      active
                        ? 'border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.1)]'
                        : 'border-white/[0.06] bg-[#0F1512] hover:border-white/[0.1] hover:bg-[#182019]',
                    )}
                  >
                    <CompanyLogo
                      company={item.company ?? 'Unknown company'}
                      logoUrl={item.companyLogoUrl}
                      size="md"
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate text-[13px] font-semibold text-[#F0F4F2]">
                        {item.company ?? 'Unknown company'}
                      </p>
                      <p className="truncate text-[11px] text-white/35">
                        {historyLoadingId === item.id
                          ? 'Loading…'
                          : item.jobTitle || item.title || 'Untitled role'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                        sc == null || !Number.isFinite(sc)
                          ? 'bg-white/[0.04] text-white/25'
                          : sc >= 80
                            ? 'bg-[rgba(0,201,177,0.12)] text-[#00C9B1]'
                            : sc >= 60
                              ? 'bg-[rgba(245,158,11,0.12)] text-[#F59E0B]'
                              : 'bg-[rgba(248,113,113,0.12)] text-[#F87171]',
                      )}
                    >
                      {sc != null && Number.isFinite(sc)
                        ? `${Math.round(sc)}%`
                        : '—'}
                    </span>
                  </button>
                );
              })}
          </div>
      </section>
    </div>
  );
}
