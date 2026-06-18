'use client';

import { useMemo, useState } from 'react';
import {
  Bell,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  Mic,
  Save,
  Sparkles,
  Wand2,
} from 'lucide-react';

import { cn } from '@/lib/utils';

type StepStatus = 'done' | 'current' | 'todo' | 'locked' | 'skipped';

export type NextStepsPanelProps = {
  tailorDone: boolean;
  coverLetterDone: boolean;
  coverLetterSkipped: boolean;
  savedDone: boolean;
  appliedDone: boolean;
  interviewPrepDone: boolean;
  reminderDone: boolean;
  /** When false, the "Apply to job" button is disabled (no posting URL known). */
  applyAvailable?: boolean;
  /** Human summary of the existing reminder, e.g. "Follow up on Jun 5". */
  reminderSummary?: string | null;
  busy?: {
    tailor?: boolean;
    coverLetter?: boolean;
    save?: boolean;
    reminder?: boolean;
  };
  onTailor: () => void;
  onGenerateCoverLetter: () => void;
  onSkipCoverLetter: () => void;
  onSaveJob: () => void;
  onApplyToJob: () => void;
  onPrepInterview: () => void;
  onSetReminder: (remindAtIso: string) => void;
  className?: string;
};

function defaultReminderLocalValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(9, 0, 0, 0);
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
        <Check className="h-3 w-3" />
        Done
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">
        Skipped
      </span>
    );
  }
  return null;
}

type StepRowProps = {
  index: number;
  status: StepStatus;
  icon: React.ReactNode;
  title: string;
  description: string;
  isLast?: boolean;
  children?: React.ReactNode;
};

function StepRow({
  index,
  status,
  icon,
  title,
  description,
  isLast,
  children,
}: StepRowProps) {
  const done = status === 'done';
  const current = status === 'current';
  const locked = status === 'locked';

  return (
    <li className="relative flex gap-3">
      {/* Rail */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
            done && 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300',
            current && 'border-[#00C9B1]/60 bg-[#00C9B1]/15 text-[#00C9B1]',
            !done &&
              !current &&
              'border-white/12 bg-white/[0.03] text-white/40',
          )}
        >
          {done ? (
            <Check className="h-4 w-4" />
          ) : locked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <span className="flex items-center justify-center">{icon}</span>
          )}
        </div>
        {!isLast && (
          <div
            className={cn(
              'mt-1 w-px flex-1',
              done ? 'bg-emerald-400/35' : 'bg-white/10',
            )}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-5')}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p
              className={cn(
                'text-sm font-semibold',
                done ? 'text-white/70' : 'text-white',
              )}
            >
              <span className="mr-1 text-white/30">{index}.</span>
              {title}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/45">
              {description}
            </p>
          </div>
          <StatusBadge status={status} />
        </div>
        {children ? <div className="mt-2.5">{children}</div> : null}
      </div>
    </li>
  );
}

const primaryBtn =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#00C9B1] px-3 text-xs font-semibold text-[#06201c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50';
const ghostBtn =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-white/[0.14] bg-transparent px-3 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50';
const linkBtn =
  'text-[11px] font-medium text-white/45 underline-offset-2 transition hover:text-white/70 hover:underline disabled:cursor-not-allowed disabled:opacity-50';

export function NextStepsPanel({
  tailorDone,
  coverLetterDone,
  coverLetterSkipped,
  savedDone,
  appliedDone,
  interviewPrepDone,
  applyAvailable = true,
  reminderDone,
  reminderSummary,
  busy,
  onTailor,
  onGenerateCoverLetter,
  onSkipCoverLetter,
  onSaveJob,
  onApplyToJob,
  onPrepInterview,
  onSetReminder,
  className,
}: NextStepsPanelProps) {
  const [reminderValue, setReminderValue] = useState(defaultReminderLocalValue);

  const TOTAL_STEPS = 6;
  const completedCount =
    (tailorDone ? 1 : 0) +
    (coverLetterDone ? 1 : 0) +
    (savedDone ? 1 : 0) +
    (appliedDone ? 1 : 0) +
    (interviewPrepDone ? 1 : 0) +
    (reminderDone ? 1 : 0);

  const tailorStatus: StepStatus = tailorDone ? 'done' : 'current';
  const coverStatus: StepStatus = coverLetterDone
    ? 'done'
    : coverLetterSkipped
      ? 'skipped'
      : tailorDone
        ? 'current'
        : 'locked';
  const saveStatus: StepStatus = savedDone ? 'done' : 'current';
  const applyStatus: StepStatus = appliedDone ? 'done' : 'current';
  const interviewStatus: StepStatus = interviewPrepDone ? 'done' : 'current';
  const reminderStatus: StepStatus = reminderDone ? 'done' : 'current';

  const progressPct = useMemo(
    () => Math.round((completedCount / TOTAL_STEPS) * 100),
    [completedCount],
  );

  return (
    <section
      className={cn(
        'min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0F1512] p-5 sm:p-6',
        className,
      )}
      aria-label="Next steps for this application"
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-[#00C9B1]" />
          <h3 className="text-[15px] font-semibold text-[#F0F4F2]">
            Next steps
          </h3>
        </div>
        <span className="shrink-0 text-[12px] tabular-nums text-white/35">
          {completedCount} of {TOTAL_STEPS} steps
        </span>
      </div>
      <div className="mb-5 h-[3px] overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[#00C9B1] transition-[width] duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="m-0 list-none p-0">
        {/* Step 1 — Tailor CV */}
        <StepRow
          index={1}
          status={tailorStatus}
          icon={<Wand2 className="h-4 w-4" />}
          title="Tailor your CV"
          description="Align your CV with this role's keywords and requirements."
        >
          {!tailorDone && (
            <button
              type="button"
              className={primaryBtn}
              disabled={busy?.tailor}
              onClick={onTailor}
            >
              {busy?.tailor ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Tailor now
            </button>
          )}
        </StepRow>

        {/* Step 2 — Cover letter */}
        <StepRow
          index={2}
          status={coverStatus}
          icon={<FileText className="h-4 w-4" />}
          title="Generate cover letter"
          description={
            coverStatus === 'locked'
              ? 'Unlocks after tailoring, or skip if you do not need one.'
              : 'Create a tailored cover letter for this application.'
          }
        >
          {!coverLetterDone && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className={primaryBtn}
                disabled={busy?.coverLetter || coverStatus === 'locked'}
                onClick={onGenerateCoverLetter}
              >
                {busy?.coverLetter ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileText className="h-3.5 w-3.5" />
                )}
                Generate
              </button>
              {!coverLetterSkipped && (
                <button
                  type="button"
                  className={linkBtn}
                  disabled={busy?.coverLetter}
                  onClick={onSkipCoverLetter}
                >
                  Skip this step
                </button>
              )}
            </div>
          )}
        </StepRow>

        {/* Step 3 — Save to Job Hub */}
        <StepRow
          index={3}
          status={saveStatus}
          icon={<Save className="h-4 w-4" />}
          title="Save to Job Hub"
          description="Track this application in your Job Hub pipeline."
        >
          {!savedDone && (
            <button
              type="button"
              className={ghostBtn}
              disabled={busy?.save}
              onClick={onSaveJob}
            >
              {busy?.save ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save job
            </button>
          )}
        </StepRow>

        {/* Step 4 — Apply to job */}
        <StepRow
          index={4}
          status={applyStatus}
          icon={<ExternalLink className="h-4 w-4" />}
          title="Apply to job"
          description={
            applyAvailable
              ? 'Open the job posting and submit your application.'
              : 'No posting link found for this job. Apply from the source listing.'
          }
        >
          <button
            type="button"
            className={primaryBtn}
            disabled={!applyAvailable}
            onClick={onApplyToJob}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {appliedDone ? 'Open job posting' : 'Apply now'}
          </button>
        </StepRow>

        {/* Step 5 — Prep for interview */}
        <StepRow
          index={5}
          status={interviewStatus}
          icon={<Mic className="h-4 w-4" />}
          title="Prep for interview"
          description="Run a mock interview tailored to this role and CV."
          isLast={!savedDone}
        >
          <button
            type="button"
            className={ghostBtn}
            onClick={onPrepInterview}
          >
            <Mic className="h-3.5 w-3.5" />
            {interviewPrepDone ? 'Resume prep' : 'Prep for interview'}
          </button>
        </StepRow>

        {/* Step 6 — Reminder (appears after save) */}
        {savedDone && (
          <StepRow
            index={6}
            status={reminderStatus}
            icon={<Bell className="h-4 w-4" />}
            title="Set follow-up reminder"
            description={
              reminderDone && reminderSummary
                ? reminderSummary
                : 'Get nudged to follow up so this application does not stall.'
            }
            isLast
          >
            {!reminderDone && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="datetime-local"
                  value={reminderValue}
                  onChange={(e) => setReminderValue(e.target.value)}
                  className="h-8 rounded-lg border border-white/[0.14] bg-[#0c1010] px-2 text-xs text-white outline-none [color-scheme:dark] focus:border-[#00C9B1]/50"
                />
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={busy?.reminder || !reminderValue}
                  onClick={() => {
                    const ms = Date.parse(reminderValue);
                    if (Number.isNaN(ms)) return;
                    onSetReminder(new Date(ms).toISOString());
                  }}
                >
                  {busy?.reminder ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Bell className="h-3.5 w-3.5" />
                  )}
                  Set reminder
                </button>
              </div>
            )}
          </StepRow>
        )}
      </ol>
    </section>
  );
}
