'use client';

import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Sparkles,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { useToast } from '@/components/ui/Toast';
import { useExportCV } from '@/hooks/useExportCV';
import { getCvExportErrorMessage } from '@/lib/cvExportErrors';
import { Button } from '@/components/ui/Button';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import type {
  CvProfileSummary,
  CvTailorDraft,
  CvTailorDraftEntry,
  JobAnalysis,
} from '@/lib/api';
import { cn } from '@/lib/utils';

import {
  changeHeadline,
  changeLines,
  looksLikeLink,
  matchSentence,
  MIN_JOB_TEXT_CHARS,
  requirementRows,
  scoreLift,
  sectionName,
  verdictFor,
  type CheckStep,
} from './checkJobModel';

const STEPS: Array<{ step: CheckStep; label: string }> = [
  { step: 1, label: 'Add the job' },
  { step: 2, label: 'See your match' },
  { step: 3, label: 'Get your CV' },
];

export function CheckJobProgress({ current }: { current: CheckStep }) {
  return (
    <ol className="flex items-center gap-2 text-[13px]" aria-label="Steps">
      {STEPS.map(({ step, label }, i) => {
        const done = step < current;
        const active = step === current;
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold',
                done && 'bg-accent-solid text-text-on-accent',
                active && 'border-2 border-accent-solid text-accent-text',
                !done &&
                  !active &&
                  'border border-border-strong text-text-tertiary',
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
              ) : (
                step
              )}
            </span>
            <span
              className={cn(
                'hidden font-semibold sm:inline',
                active ? 'text-text-primary' : 'text-text-tertiary',
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 ? (
              <span
                className="h-px w-6 bg-border-default sm:w-10"
                aria-hidden
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Panel({
  children,
  className,
  tour,
}: {
  children: ReactNode;
  className?: string;
  tour?: string;
}) {
  return (
    <section
      data-tour={tour}
      className={cn(
        'rounded-3xl border border-border-subtle bg-bg-surface p-5 shadow-raised sm:p-7',
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Rotating plain-English status for the long waits, so it never looks stuck. */
export function WorkingPanel({
  title,
  steps,
  note,
}: {
  title: string;
  steps: string[];
  note: string;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setI((n) => Math.min(n + 1, steps.length - 1)),
      6000,
    );
    return () => window.clearInterval(id);
  }, [steps.length]);
  return (
    <Panel className="text-center" tour="check-working">
      <Loader2
        className="mx-auto h-8 w-8 animate-spin text-accent-text"
        aria-hidden
      />
      <h2 className="mt-4 font-display text-[22px] font-bold text-text-primary">
        {title}
      </h2>
      <ol
        className="mx-auto mt-4 max-w-[320px] space-y-2 text-left text-[14px]"
        aria-live="polite"
      >
        {steps.map((s, n) => (
          <li
            key={s}
            className={cn(
              'flex items-center gap-2',
              n < i
                ? 'text-text-secondary'
                : n === i
                  ? 'font-semibold text-text-primary'
                  : 'text-text-tertiary',
            )}
          >
            {n < i ? (
              <Check className="h-4 w-4 text-success-text" aria-hidden />
            ) : n === i ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <span
                className="h-4 w-4 rounded-full border border-border-strong"
                aria-hidden
              />
            )}
            {s}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[13px] text-text-tertiary">{note}</p>
    </Panel>
  );
}

function ErrorNote({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-danger-border bg-danger-subtle px-4 py-3 text-[14px] text-danger-text"
    >
      <span className="flex-1">{message}</span>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="font-semibold underline underline-offset-4"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Step 1 */

export function AddJobStep({
  text,
  onText,
  cvRows,
  cvId,
  onCvChange,
  error,
  onSubmit,
  recent,
}: {
  text: string;
  onText: (v: string) => void;
  cvRows: CvProfileSummary[];
  cvId: string | null;
  onCvChange: (id: string) => void;
  error: string | null;
  onSubmit: () => void;
  recent: Array<{
    id: string;
    title: string;
    company: string;
    score: number | null;
    logoUrl: string | null;
  }>;
}) {
  const isLink = looksLikeLink(text);
  const trimmed = text.trim();
  const tooShort =
    !isLink && trimmed.length > 0 && trimmed.length < MIN_JOB_TEXT_CHARS;
  const canSubmit =
    Boolean(cvId) && (isLink || trimmed.length >= MIN_JOB_TEXT_CHARS);
  const cv = cvRows.find((r) => r.id === cvId) ?? null;

  return (
    <>
      <Panel tour="check-add">
        <label
          htmlFor="check-job-input"
          className="block font-display text-[18px] font-bold text-text-primary"
        >
          Paste the job
        </label>
        <p className="mt-1 text-[14px] text-text-secondary">
          A link to the job, or the whole job description. Either works.
        </p>
        <textarea
          id="check-job-input"
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canSubmit)
              onSubmit();
          }}
          rows={7}
          maxLength={20000}
          placeholder="e.g. https://jobs.lever.co/company/123, or the full job description"
          className="mt-4 w-full resize-y rounded-2xl border border-border-default bg-bg-sunken px-4 py-3 text-[15px] leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary focus:border-border-focus"
        />
        <p
          className="mt-2 min-h-[20px] text-[13px] text-text-tertiary"
          aria-live="polite"
        >
          {isLink ? (
            <span className="inline-flex items-center gap-1.5 text-accent-text">
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              We&apos;ll read the job from this link.
            </span>
          ) : tooShort ? (
            'Paste the whole description, not just the title, so we can compare it properly.'
          ) : null}
        </p>

        {cvRows.length > 1 ? (
          <label className="mt-3 flex flex-wrap items-center gap-2 text-[14px] text-text-secondary">
            <FileText className="h-4 w-4" aria-hidden />
            Compare with
            <select
              value={cvId ?? ''}
              onChange={(e) => onCvChange(e.target.value)}
              aria-label="CV to compare with"
              className="h-9 max-w-full rounded-lg border border-border-default bg-bg-surface px-2 text-[14px] font-semibold text-text-primary"
            >
              {cvRows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : cv ? (
          <p className="mt-3 flex items-center gap-2 text-[14px] text-text-secondary">
            <FileText className="h-4 w-4" aria-hidden />
            Comparing with{' '}
            <span className="font-semibold text-text-primary">{cv.name}</span>
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            variant="accent"
            className="px-7"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            Check my match
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Button>
          <span className="text-[13px] text-text-tertiary">
            About 30 seconds · uses 1 AI credit
          </span>
        </div>
        {error ? <ErrorNote message={error} /> : null}
      </Panel>

      {recent.length > 0 ? (
        <section className="mt-6" aria-labelledby="check-recent">
          <h2
            id="check-recent"
            className="mb-2 text-[14px] font-semibold text-text-secondary"
          >
            Jobs you checked recently
          </h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/dashboard/jobs/analyze?jobId=${encodeURIComponent(r.id)}`}
                  className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg-surface p-3 transition-colors hover:bg-bg-hover"
                >
                  <CompanyLogo
                    company={r.company}
                    logoUrl={r.logoUrl}
                    size="md"
                    shape="rounded"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-text-primary">
                      {r.title || 'Untitled job'}
                    </span>
                    <span className="block truncate text-[13px] text-text-secondary">
                      {r.company}
                    </span>
                  </span>
                  {r.score != null ? (
                    <span className="text-[13px] font-bold text-text-primary">
                      {Math.round(r.score)}%
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ Step 2 */

const SHOWN_ROWS = 10;

function JobHeader({
  title,
  company,
  logoUrl,
}: {
  title: string;
  company: string;
  logoUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <CompanyLogo
        company={company}
        logoUrl={logoUrl}
        size="lg"
        shape="rounded"
      />
      <div className="min-w-0">
        <h2 className="truncate font-display text-[20px] font-bold text-text-primary">
          {title || 'This job'}
        </h2>
        {company ? (
          <p className="truncate text-[14px] text-text-secondary">{company}</p>
        ) : null}
      </div>
    </div>
  );
}

const TONE_TEXT: Record<string, string> = {
  success: 'text-success-text',
  accent: 'text-accent-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
};

const TONE_STROKE: Record<string, string> = {
  success: 'var(--ck-success-text)',
  accent: 'var(--ck-accent-solid)',
  warning: 'var(--ck-warning-text)',
  danger: 'var(--ck-danger-text)',
};

function BigScore({ score, tone }: { score: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative h-24 w-24 shrink-0"
      role="img"
      aria-label={`Match ${Math.round(pct)}%`}
    >
      <svg viewBox="0 0 96 96" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="var(--ck-bg-hover)"
          strokeWidth="8"
        />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={TONE_STROKE[tone] ?? TONE_STROKE.accent}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display text-[26px] font-bold text-text-primary"
        aria-hidden
      >
        {Math.round(pct)}
        <span className="text-[14px]">%</span>
      </span>
    </div>
  );
}

const FACTOR_WORDS: Record<string, string> = {
  skillsMatch: 'Skills they ask for',
  experienceMatch: 'Years of experience',
  keywordCoverage: 'Their exact words on your CV',
  seniorityAlignment: 'Level of the role',
  industryRelevance: 'Industry',
  evidenceStrength: 'Proof in your bullets',
};

export function MatchStep({
  analysis,
  title,
  company,
  logoUrl,
  confirmed,
  onToggle,
  onTailor,
  error,
  onStartOver,
}: {
  analysis: JobAnalysis;
  title: string;
  company: string;
  logoUrl: string | null;
  confirmed: ReadonlySet<string>;
  onToggle: (label: string) => void;
  onTailor: () => void;
  error: string | null;
  onStartOver: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const rows = requirementRows(analysis);
  const shown = showAll ? rows : rows.slice(0, SHOWN_ROWS);
  const score = Math.round(analysis.matchScore ?? 0);
  const verdict = verdictFor(score);
  const sentence = matchSentence(rows);
  const strengths = (analysis.strengths ?? []).slice(0, 3);
  const location = analysis.locationEligibility?.message?.trim();
  const factors = analysis.factorsBreakdown?.factors ?? [];

  return (
    <>
      <Panel tour="check-match">
        <JobHeader title={title} company={company} logoUrl={logoUrl} />
        <div className="mt-5 flex flex-wrap items-center gap-5 rounded-2xl bg-bg-sunken p-4">
          <BigScore score={score} tone={verdict.tone} />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'font-display text-[22px] font-bold',
                TONE_TEXT[verdict.tone],
              )}
            >
              {verdict.label}
            </p>
            {sentence ? (
              <p className="mt-0.5 text-[15px] text-text-primary">{sentence}</p>
            ) : null}
            {location ? (
              <p className="mt-1 text-[13px] text-warning-text">{location}</p>
            ) : null}
          </div>
        </div>

        {rows.length > 0 ? (
          <div className="mt-6">
            <h3 className="font-display text-[17px] font-bold text-text-primary">
              What they ask for
            </h3>
            <p className="mt-0.5 text-[13px] text-text-secondary">
              Tap <span className="font-semibold">I have this</span> for
              anything you really have. We only add what you confirm.
            </p>
            <ul className="mt-3 divide-y divide-border-subtle rounded-2xl border border-border-subtle">
              {shown.map((r) => {
                const added = confirmed.has(r.label);
                return (
                  <li
                    key={r.key}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    {r.have ? (
                      <Check
                        className="h-4 w-4 shrink-0 text-success-text"
                        aria-label="On your CV"
                      />
                    ) : (
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border-2 border-warning-text"
                        aria-label="Not on your CV"
                      />
                    )}
                    <span className="min-w-0 flex-1 text-[14px] text-text-primary">
                      {r.label}
                      {!r.required && !r.have ? (
                        <span className="ml-2 text-[12px] text-text-tertiary">
                          nice to have
                        </span>
                      ) : null}
                    </span>
                    {r.have ? (
                      <span className="text-[13px] text-text-tertiary">
                        On your CV
                      </span>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={added}
                        onClick={() => onToggle(r.label)}
                        className={cn(
                          'inline-flex min-h-[32px] items-center gap-1 rounded-full border px-3 text-[13px] font-semibold transition-colors',
                          added
                            ? 'border-accent-solid bg-accent-solid text-text-on-accent'
                            : 'border-border-default text-text-primary hover:bg-bg-hover',
                        )}
                      >
                        {added ? (
                          <Check
                            className="h-3.5 w-3.5"
                            strokeWidth={3}
                            aria-hidden
                          />
                        ) : null}
                        I have this
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {rows.length > SHOWN_ROWS ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-2 text-[13px] font-semibold text-accent-text"
              >
                {showAll ? 'Show fewer' : `Show all ${rows.length}`}
              </button>
            ) : null}
          </div>
        ) : null}

        {strengths.length > 0 ? (
          <div className="mt-6">
            <h3 className="font-display text-[17px] font-bold text-text-primary">
              Why you fit
            </h3>
            <ul className="mt-2 space-y-1.5">
              {strengths.map((s) => (
                <li
                  key={s}
                  className="flex gap-2 text-[14px] text-text-primary"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-success-text"
                    aria-hidden
                  />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {factors.length > 0 ? (
          <div className="mt-6 border-t border-border-subtle pt-4">
            <button
              type="button"
              aria-expanded={showWhy}
              onClick={() => setShowWhy((v) => !v)}
              className="inline-flex items-center gap-1 text-[14px] font-semibold text-text-secondary hover:text-text-primary"
            >
              How the score was worked out
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform',
                  showWhy && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            {showWhy ? (
              <ul className="mt-3 space-y-3">
                {factors.map((f) => (
                  <li key={f.key}>
                    <div className="flex items-center justify-between gap-3 text-[14px]">
                      <span className="font-semibold text-text-primary">
                        {FACTOR_WORDS[f.key] ?? f.label}
                      </span>
                      <span className="font-semibold text-text-primary">
                        {Math.round(f.score)}%
                      </span>
                    </div>
                    {f.explanation ? (
                      <p className="mt-0.5 text-[13px] text-text-secondary">
                        {f.explanation}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Panel>

      <Panel
        className="mt-4 border-accent-border bg-accent-subtle"
        tour="check-tailor"
      >
        <h3 className="font-display text-[18px] font-bold text-text-primary">
          Make your CV fit this job
        </h3>
        <p className="mt-1 text-[14px] text-text-secondary">
          We make a copy of your CV for this job, reword your summary and
          bullets to match it
          {confirmed.size > 0
            ? ` and add ${[...confirmed].slice(0, 3).join(', ')}${confirmed.size > 3 ? '…' : ''}`
            : ''}
          . Your original CV stays the same, and nothing is made up.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button variant="accent" className="px-7" onClick={onTailor}>
            <Sparkles className="mr-1.5 h-4 w-4" aria-hidden />
            Tailor my CV
          </Button>
          <span className="text-[13px] text-text-tertiary">
            About 30 seconds · uses 1 AI credit
          </span>
        </div>
        {error ? <ErrorNote message={error} onRetry={onTailor} /> : null}
      </Panel>

      <p className="mt-4 text-center text-[13px] text-text-tertiary">
        Saved to your Job Hub.{' '}
        <button
          type="button"
          onClick={onStartOver}
          className="font-semibold text-accent-text"
        >
          Check another job
        </button>
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ Step 3 */

function DownloadButtons({
  cvProfileId,
  jobAnalysisId,
  template,
}: {
  cvProfileId: string;
  jobAnalysisId: string;
  template: string | null;
}) {
  const exportCv = useExportCV();
  const toast = useToast();
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null);
  const download = async (format: 'pdf' | 'docx') => {
    setBusy(format);
    try {
      await exportCv.mutateAsync({
        format,
        template: template?.trim() || 'modern',
        cvProfileId,
        jobAnalysisId,
      });
      toast.success(
        format === 'pdf'
          ? 'Your CV is downloading.'
          : 'Your Word file is downloading.',
      );
    } catch (e) {
      toast.error(getCvExportErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <Button
        variant="accent"
        className="px-6"
        disabled={busy !== null}
        onClick={() => void download('pdf')}
      >
        {busy === 'pdf' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Download className="mr-1.5 h-4 w-4" aria-hidden />
        )}
        Download PDF
      </Button>
      <Button
        variant="outline"
        disabled={busy !== null}
        onClick={() => void download('docx')}
      >
        {busy === 'docx' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
        ) : null}
        Word file
      </Button>
    </>
  );
}

export function TailoredStep({
  draft,
  cvName,
  title,
  company,
  logoUrl,
  scoreBefore,
  scoreAfter,
  applyUrl,
  template,
  jobAnalysisId,
  busyEntryId,
  onUndo,
  onPutBack,
  coverLetter,
  coverBusy,
  coverError,
  onCoverLetter,
  onStartOver,
}: {
  draft: CvTailorDraft;
  cvName: string | null;
  title: string;
  company: string;
  logoUrl: string | null;
  scoreBefore: number | null;
  scoreAfter: number | null;
  applyUrl: string | null;
  template: string | null;
  jobAnalysisId: string;
  busyEntryId: string | null;
  onUndo: (entry: CvTailorDraftEntry) => void;
  onPutBack: (entry: CvTailorDraftEntry) => void;
  coverLetter: string | null;
  coverBusy: boolean;
  coverError: string | null;
  onCoverLetter: () => void;
  onStartOver: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lift = scoreLift(scoreBefore, scoreAfter);

  return (
    <>
      <Panel tour="check-done">
        <JobHeader title={title} company={company} logoUrl={logoUrl} />
        <div className="mt-5 rounded-2xl border border-success-border bg-success-subtle p-4">
          <p className="flex items-center gap-2 font-display text-[20px] font-bold text-text-primary">
            <Check
              className="h-5 w-5 text-success-text"
              strokeWidth={3}
              aria-hidden
            />
            Your CV for {company || 'this job'} is ready
          </p>
          {scoreAfter != null ? (
            <p className="mt-1 text-[15px] text-text-primary">
              Match{' '}
              {scoreBefore != null ? (
                <>
                  <span className="text-text-secondary">
                    {Math.round(scoreBefore)}%
                  </span>
                  <span className="mx-1.5 text-text-tertiary">→</span>
                </>
              ) : null}
              <span className="font-bold">{Math.round(scoreAfter)}%</span>
              {lift != null && lift > 0 ? (
                <span className="ml-2 font-semibold text-success-text">
                  +{lift}
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="mt-1 text-[13px] text-text-secondary">
            Saved as a new CV:{' '}
            <span className="font-semibold">{cvName || 'Tailored CV'}</span>.
            Your original is unchanged.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <DownloadButtons
            cvProfileId={draft.cvProfileId}
            jobAnalysisId={jobAnalysisId}
            template={template}
          />
          {applyUrl ? (
            <Button asChild variant="outline">
              <a href={applyUrl} target="_blank" rel="noopener noreferrer">
                Apply on their site
                <ExternalLink className="ml-1.5 h-4 w-4" aria-hidden />
              </a>
            </Button>
          ) : null}
        </div>
      </Panel>

      <Panel className="mt-4" tour="check-changes">
        <h3 className="font-display text-[17px] font-bold text-text-primary">
          What we changed
        </h3>
        <p className="mt-0.5 text-[13px] text-text-secondary">
          Don&apos;t like a change? Undo it.
        </p>
        <ul className="mt-3 divide-y divide-border-subtle rounded-2xl border border-border-subtle">
          {draft.drafts.map((entry) => {
            const applied = entry.status === 'accepted';
            const lines = changeLines(entry);
            const isOpen = open === entry.sectionId;
            const busy = busyEntryId === entry.sectionId;
            return (
              <li key={entry.sectionId} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-text-primary">
                      {sectionName(entry.sectionType)}
                      {!applied ? (
                        <span className="ml-2 text-[12px] font-normal text-text-tertiary">
                          undone
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[13px] text-text-secondary">
                      {changeHeadline(entry)}
                    </p>
                  </div>
                  {lines.before.length + lines.after.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : entry.sectionId)}
                      className="text-[13px] font-semibold text-accent-text"
                    >
                      {isOpen ? 'Hide' : 'See the change'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || (applied && !entry.patchId)}
                    onClick={() => (applied ? onUndo(entry) : onPutBack(entry))}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-border-default px-3 text-[13px] font-semibold text-text-primary hover:bg-bg-hover disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden
                      />
                    ) : applied ? (
                      <Undo2 className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {applied ? 'Undo' : 'Put back'}
                  </button>
                </div>
                {isOpen ? (
                  <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
                    <div className="rounded-xl bg-bg-sunken p-3">
                      <p className="mb-1 font-semibold text-text-secondary">
                        Before
                      </p>
                      {lines.before.length ? (
                        <ul className="space-y-1 text-text-secondary">
                          {lines.before.map((l) => (
                            <li key={`b-${l}`}>{l}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-text-tertiary">
                          Nothing here before.
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl bg-accent-subtle p-3">
                      <p className="mb-1 font-semibold text-accent-text">
                        After
                      </p>
                      <ul className="space-y-1 text-text-primary">
                        {lines.after.map((l) => (
                          <li key={`a-${l}`}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel className="mt-4" tour="check-next">
        <h3 className="font-display text-[17px] font-bold text-text-primary">
          Next
        </h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={onCoverLetter}
            disabled={coverBusy}
            className="flex items-center gap-2 rounded-2xl border border-border-subtle p-3 text-left text-[14px] font-semibold text-text-primary hover:bg-bg-hover disabled:opacity-60"
          >
            {coverBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <MessageSquare className="h-4 w-4" aria-hidden />
            )}
            {coverLetter ? 'Write it again' : 'Write a cover letter'}
          </button>
          <Link
            href="/dashboard/interview"
            className="flex items-center gap-2 rounded-2xl border border-border-subtle p-3 text-[14px] font-semibold text-text-primary hover:bg-bg-hover"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Practise the interview
          </Link>
          <Link
            href={`/dashboard/cv?profileId=${encodeURIComponent(draft.cvProfileId)}`}
            className="flex items-center gap-2 rounded-2xl border border-border-subtle p-3 text-[14px] font-semibold text-text-primary hover:bg-bg-hover"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit this CV yourself
          </Link>
        </div>
        {coverError ? (
          <ErrorNote message={coverError} onRetry={onCoverLetter} />
        ) : null}
        {coverLetter ? (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-[14px] font-semibold text-text-primary">
                Your cover letter
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(coverLetter).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent-text"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-bg-sunken p-4 text-[14px] leading-relaxed text-text-primary">
              {coverLetter}
            </p>
          </div>
        ) : null}
      </Panel>

      <p className="mt-4 text-center text-[13px] text-text-tertiary">
        Saved to your Job Hub as tailored.{' '}
        <button
          type="button"
          onClick={onStartOver}
          className="font-semibold text-accent-text"
        >
          Check another job
        </button>
      </p>
    </>
  );
}
