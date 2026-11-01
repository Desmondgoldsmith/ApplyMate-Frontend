'use client';

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  FilePlus2,
  Loader2,
  MinusCircle,
  PenLine,
  Sparkles,
  Wand2,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  api,
  type CvAutopilotChangeGoal,
  type CvAutopilotCreateAnswers,
  type CvAutopilotPlan,
  type CvAutopilotRequest,
  type CvAutopilotRun,
  type CvAutopilotStep,
  type CvAutopilotStepStatus,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';

type Stage =
  | 'choose'
  | 'goal'
  | 'create'
  | 'planning'
  | 'plan'
  | 'running'
  | 'done';

/** The answers form as typed: list fields are free text until submitted. */
type AnswersDraft = Omit<
  CvAutopilotCreateAnswers,
  'achievements' | 'skills'
> & {
  achievementsText: string;
  skillsText: string;
};

const EMPTY_ANSWERS: AnswersDraft = {
  fullName: '',
  email: '',
  jobTitle: '',
  company: '',
  startDate: '',
  current: true,
  achievementsText: '',
  skillsText: '',
  degree: '',
  school: '',
  graduationYear: '',
};

function answersFromDraft(draft: AnswersDraft): CvAutopilotCreateAnswers {
  const { achievementsText, skillsText, ...rest } = draft;
  return {
    ...rest,
    achievements: achievementsText
      .split(/\n+/)
      .map((s) => s.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean),
    skills: skillsText
      .split(/[,\n]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

/** Why the quick-create form cannot continue yet, or null. Mirrors the server's checks. */
function createProblem(
  request: CvAutopilotRequest,
  file: File | null,
  draft: AnswersDraft,
): string | null {
  if ((request.targetRole?.trim().length ?? 0) < 2) {
    return 'Name the role this CV is for.';
  }
  if (request.createSource === 'upload') {
    return file ? null : 'Choose your CV or LinkedIn PDF.';
  }
  const answers = answersFromDraft(draft);
  if (!answers.fullName.trim()) return 'Add your full name.';
  if (!answers.jobTitle.trim() || !answers.company.trim()) {
    return 'Add your current or latest job title and company.';
  }
  if (answers.skills.length < 3) return 'Add at least three skills.';
  return null;
}

const POLL_MS = 1500;

const STATUS_TEXT: Record<CvAutopilotStepStatus, string> = {
  planned: 'Waiting',
  running: 'Working on it…',
  applied: 'Done',
  needs_input: 'Needs a detail from you',
  skipped_by_you: 'Skipped, as you asked',
  no_change: 'Left as is: nothing to change without inventing facts',
  unsafe: 'Left as is: the rewrite changed your facts',
  failed: 'Could not do this one',
  not_started: 'Not started (stopped)',
};

const GOALS: Array<{
  id: CvAutopilotChangeGoal;
  label: string;
  hint: string;
  keepOriginalByDefault: boolean;
}> = [
  {
    id: 'tailor_job',
    label: 'Tailor it to a job',
    hint: 'Paste the job; it brings out what the job asks for.',
    keepOriginalByDefault: true,
  },
  {
    id: 'change_role',
    label: 'Target a different role',
    hint: 'Repositions your CV for the role you name.',
    keepOriginalByDefault: true,
  },
  {
    id: 'one_page',
    label: 'Fit it on one page',
    hint: 'Tighter summary and shorter bullets, same facts.',
    keepOriginalByDefault: false,
  },
  {
    id: 'more_senior',
    label: 'Sound more senior',
    hint: 'Leads with scope and ownership you already show.',
    keepOriginalByDefault: false,
  },
  {
    id: 'custom',
    label: 'Something else',
    hint: 'Tell it in your own words.',
    keepOriginalByDefault: false,
  },
];

function StepIcon({ status }: { status: CvAutopilotStepStatus }) {
  const cls = 'h-4 w-4 shrink-0';
  if (status === 'applied')
    return <CheckCircle2 className={cn(cls, 'text-success-text')} />;
  if (status === 'running')
    return <Loader2 className={cn(cls, 'animate-spin text-accent-text')} />;
  if (status === 'needs_input')
    return <AlertCircle className={cn(cls, 'text-warning-text')} />;
  if (status === 'failed' || status === 'unsafe')
    return <XCircle className={cn(cls, 'text-danger-text')} />;
  if (status === 'skipped_by_you' || status === 'no_change')
    return <MinusCircle className={cn(cls, 'text-text-tertiary')} />;
  return <Circle className={cn(cls, 'text-text-tertiary')} />;
}

function sectionLabel(section: string): string {
  const s = section.trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'CV';
}

/** Why the goal form cannot continue yet, or null. Mirrors the server's checks. */
function goalProblem(request: CvAutopilotRequest): string | null {
  if (
    request.goal === 'tailor_job' &&
    (request.jobDescription?.trim().length ?? 0) < 80
  ) {
    return 'Paste the job description (a few lines at least).';
  }
  if (
    request.goal === 'change_role' &&
    (request.targetRole?.trim().length ?? 0) < 2
  ) {
    return 'Name the role to target.';
  }
  if (
    request.goal === 'custom' &&
    (request.customGoal?.trim().length ?? 0) < 5
  ) {
    return 'Tell Autopilot what to change.';
  }
  return null;
}

const fieldClass =
  'w-full rounded-lg border border-border-default bg-bg-sunken px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-solid focus:ring-2 focus:ring-accent-border';

export type CvAutopilotModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string | null;
  allowed: boolean;
  /** Save any open edit before Autopilot reads the CV. */
  beforeStart: () => Promise<void>;
  /** The server changed the CV: reload it into the editor. */
  onCvChanged: () => Promise<void>;
  /** "Undo all" restored the CV: reload it and reset local undo history. */
  onUndone: () => Promise<void>;
  /** Switch the editor to another CV (the copy a run created). */
  onOpenProfile: (profileId: string) => void;
};

export function CvAutopilotModal({
  open,
  onOpenChange,
  profileId,
  allowed,
  beforeStart,
  onCvChanged,
  onUndone,
  onOpenProfile,
}: CvAutopilotModalProps) {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('choose');
  const [request, setRequest] = useState<CvAutopilotRequest>({
    mode: 'fix_all',
  });
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [plan, setPlan] = useState<CvAutopilotPlan | null>(null);
  const [instructions, setInstructions] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [run, setRun] = useState<CvAutopilotRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const showError = useCallback(
    (e: unknown) => {
      const message = getApiErrorMessage(e);
      setError(message);
      toast.error(message);
    },
    [toast],
  );
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [answersDraft, setAnswersDraft] = useState<AnswersDraft>(EMPTY_ANSWERS);
  const appliedSeen = useRef(0);

  useEffect(() => {
    if (!open) return;
    setStage('choose');
    setRequest({ mode: 'fix_all' });
    setCreateFile(null);
    setAnswersDraft(EMPTY_ANSWERS);
    setBusyText(null);
    setError(null);
    setKeepOriginal(false);
    setPlan(null);
    setInstructions('');
    setExcluded(new Set());
    setFacts({});
    setRun(null);
    appliedSeen.current = 0;
  }, [open]);

  const loadPlan = useCallback(
    async (next: CvAutopilotRequest, text: string) => {
      if (!profileId) return;
      const previous = stage;
      setStage('planning');
      setError(null);
      try {
        await beforeStart();
        const result = await api.cv.planAutopilot(profileId, {
          ...next,
          ...(text.trim() ? { instructions: text.trim() } : {}),
        });
        setPlan(result);
        setStage('plan');
      } catch (e) {
        showError(e);
        setStage(previous === 'planning' ? 'choose' : previous);
      }
    },
    [beforeStart, profileId, stage, showError],
  );

  const runnableSteps = (plan?.steps ?? []).filter(
    (s) =>
      !excluded.has(s.id) &&
      (s.status === 'planned' ||
        (s.status === 'needs_input' && facts[s.id]?.trim())),
  );

  /** Quick create from a file: upload it into a new CV before the run starts. */
  const uploadIntoNewCv = async (file: File): Promise<string> => {
    setBusyText('Reading your file…');
    const created = await api.cv.createProfile({
      name: `${request.targetRole?.trim() || 'New'} CV`,
    });
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.cv.parse(formData, {
        rebuildSections: true,
        cvProfileId: created.id,
      });
    } catch (e) {
      // Do not leave an empty CV in the user's list when the file could not be read.
      await api.cv.deleteCvProfileById(created.id).catch(() => undefined);
      throw e;
    }
    return created.id;
  };

  const start = async () => {
    if (!profileId || !plan) return;
    setBusy(true);
    setError(null);
    let uploadedId: string | null = null;
    try {
      await beforeStart();
      const filledFacts = Object.fromEntries(
        Object.entries(facts).filter(([, v]) => v.trim()),
      );
      const common = {
        ...request,
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        excludeStepIds: [...excluded],
      };
      if (
        request.mode === 'create' &&
        request.createSource === 'upload' &&
        createFile
      ) {
        uploadedId = await uploadIntoNewCv(createFile);
      }
      const started =
        request.mode === 'create'
          ? await api.cv.startAutopilot(profileId, {
              ...common,
              ...(uploadedId
                ? { createdProfileId: uploadedId }
                : { answers: answersFromDraft(answersDraft) }),
            })
          : await api.cv.startAutopilot(profileId, {
              ...common,
              ...(request.mode === 'fix_all'
                ? { facts: filledFacts }
                : { keepOriginal }),
            });
      appliedSeen.current = 0;
      setRun(started);
      setStage('running');
    } catch (e) {
      if (uploadedId) {
        await api.cv.deleteCvProfileById(uploadedId).catch(() => undefined);
      }
      showError(e);
    } finally {
      setBusy(false);
      setBusyText(null);
    }
  };

  useEffect(() => {
    if (stage !== 'running' || !run || !profileId) return;
    let cancelled = false;
    const id = window.setInterval(async () => {
      try {
        const next = await api.cv.getAutopilotRun(profileId, run.id);
        if (cancelled) return;
        setRun(next);
        const applied = next.steps.filter((s) => s.status === 'applied').length;
        const finished = next.status !== 'running';
        // A copy is changed off-screen; only the CV open in the editor needs reloading.
        if (!next.copy && (applied > appliedSeen.current || finished)) {
          appliedSeen.current = applied;
          await onCvChanged();
        }
        if (finished) setStage('done');
      } catch {
        /* keep polling; a transient error must not end the run view */
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [stage, run, profileId, onCvChanged]);

  const stop = async () => {
    if (!profileId || !run) return;
    try {
      setRun(await api.cv.stopAutopilotRun(profileId, run.id));
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    }
  };

  const undoAll = async () => {
    if (!profileId || !run) return;
    setBusy(true);
    try {
      setRun(await api.cv.undoAutopilotRun(profileId, run.id));
      if (run.mode === 'create') {
        toast.success('New CV deleted.');
      } else if (run.copy) {
        toast.success('Copy deleted. Your original CV was never changed.');
      } else {
        await onUndone();
        toast.success('Done. Your CV is back to how it was before Autopilot.');
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const running = stage === 'running';
  const title =
    stage === 'done'
      ? run?.undone
        ? run.mode === 'create'
          ? 'New CV deleted'
          : run.copy
            ? 'Copy deleted'
            : 'Changes undone'
        : run?.status === 'stopped'
          ? 'Autopilot stopped'
          : 'Autopilot finished'
      : stage === 'goal'
        ? 'Change my CV'
        : stage === 'create'
          ? 'Quick create a CV'
          : 'Autopilot';
  const description =
    stage === 'choose'
      ? 'Tell it what you want. It plans the work, you approve it, it does the rest.'
      : stage === 'goal'
        ? 'What should Autopilot change?'
        : stage === 'create'
          ? 'A finished CV in a few minutes. The CV you have open stays as it is.'
          : stage === 'plan'
            ? 'Here is what Autopilot will do. Untick anything you want to keep, or tell it what to change.'
            : stage === 'running'
              ? 'Working on your CV. You can watch it change, or stop at any time.'
              : undefined;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && (running || busy)) return;
        onOpenChange(next);
      }}
      title={title}
      description={description}
      className="max-w-xl"
      scrollBody
      closeOnOverlayClick={!running && !busy}
      showCloseButton={!running}
    >
      {error &&
      (stage === 'choose' ||
        stage === 'goal' ||
        stage === 'create' ||
        stage === 'plan') ? (
        <p
          role="alert"
          className="mb-3 rounded-lg border border-danger-border bg-danger-subtle px-3 py-2 text-xs text-danger-text"
        >
          {error}
        </p>
      ) : null}
      {stage === 'choose' ? (
        allowed ? (
          <ChooseMode
            onFixAll={() => {
              const next: CvAutopilotRequest = { mode: 'fix_all' };
              setRequest(next);
              void loadPlan(next, '');
            }}
            onChange={() => {
              setRequest({ mode: 'change', goal: 'tailor_job' });
              setKeepOriginal(true);
              setStage('goal');
            }}
            onCreate={() => {
              setRequest({
                mode: 'create',
                createSource: 'upload',
                targetRole: '',
              });
              setStage('create');
            }}
          />
        ) : (
          <ProPanel />
        )
      ) : null}

      {stage === 'create' ? (
        <CreateForm
          request={request}
          onRequest={setRequest}
          file={createFile}
          onFile={setCreateFile}
          draft={answersDraft}
          onDraft={setAnswersDraft}
          onBack={() => setStage('choose')}
          onNext={() => void loadPlan(request, '')}
        />
      ) : null}

      {stage === 'goal' ? (
        <GoalForm
          request={request}
          onRequest={setRequest}
          keepOriginal={keepOriginal}
          onKeepOriginal={setKeepOriginal}
          onBack={() => setStage('choose')}
          onNext={() => void loadPlan(request, '')}
        />
      ) : null}

      {stage === 'planning' ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Loader2 className="h-7 w-7 animate-spin text-accent-text" />
          <p className="mt-3 text-sm font-medium text-text-secondary">
            Reading your CV and planning the work…
          </p>
        </div>
      ) : null}

      {stage === 'plan' && plan ? (
        <div className="space-y-4">
          {plan.mode === 'fix_all' ? (
            <p className="text-[13px] text-text-secondary">
              Score{' '}
              <span className="font-semibold text-text-primary">
                {plan.scoreBefore ?? '—'}
              </span>{' '}
              · {plan.issuesBefore} issue{plan.issuesBefore === 1 ? '' : 's'}{' '}
              found
            </p>
          ) : (
            <p className="text-[13px] text-text-secondary">
              {plan.mode === 'create'
                ? 'Creates a new CV; the one you have open stays as it is.'
                : keepOriginal
                  ? 'Works on a new copy; your current CV stays as it is.'
                  : 'Changes this CV. You can undo it all at once.'}
            </p>
          )}
          {plan.steps.length === 0 ? (
            <p className="rounded-xl border border-border-subtle bg-bg-sunken p-4 text-sm text-text-secondary">
              {plan.mode === 'fix_all'
                ? 'Nothing to fix right now. Your CV has no open issues.'
                : 'Your CV has no sections this goal can work on yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle rounded-xl border border-border-subtle">
              {plan.steps.map((step) => (
                <PlanStepRow
                  key={step.id}
                  step={step}
                  included={!excluded.has(step.id)}
                  onToggle={(include) =>
                    setExcluded((prev) => {
                      const next = new Set(prev);
                      if (include) next.delete(step.id);
                      else next.add(step.id);
                      return next;
                    })
                  }
                  fact={facts[step.id] ?? ''}
                  onFact={(value) =>
                    setFacts((prev) => ({ ...prev, [step.id]: value }))
                  }
                />
              ))}
            </ul>
          )}
          <div>
            <label
              htmlFor="autopilot-instructions"
              className="mb-1.5 block text-[13px] font-medium text-text-secondary"
            >
              Anything to change?{' '}
              <span className="font-normal text-text-tertiary">
                e.g. &ldquo;Don&rsquo;t touch my summary&rdquo;
              </span>
            </label>
            <div className="flex gap-2">
              <textarea
                id="autopilot-instructions"
                value={instructions}
                maxLength={1000}
                rows={2}
                onChange={(e) => setInstructions(e.target.value)}
                className={cn(fieldClass, 'min-h-[44px] flex-1 resize-y')}
                placeholder="Type a correction and update the plan"
              />
              <Button
                type="button"
                variant="ghost"
                className="h-auto shrink-0 border border-border-subtle px-3 text-xs"
                disabled={!instructions.trim()}
                onClick={() => void loadPlan(request, instructions)}
              >
                Update plan
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <p className="text-xs text-text-tertiary">
              Saved as one version, so you can undo it all at once.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="border border-border-subtle"
                onClick={() =>
                  setStage(
                    request.mode === 'change'
                      ? 'goal'
                      : request.mode === 'create'
                        ? 'create'
                        : 'choose',
                  )
                }
              >
                Back
              </Button>
              <Button
                type="button"
                variant="accent"
                disabled={busy || runnableSteps.length === 0}
                onClick={() => void start()}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-1.5 h-4 w-4" />
                )}
                {busy && busyText
                  ? busyText
                  : request.mode === 'fix_all'
                    ? `Fix ${runnableSteps.length} issue${runnableSteps.length === 1 ? '' : 's'}`
                    : request.mode === 'create'
                      ? 'Create my CV'
                      : `Start (${runnableSteps.length} step${runnableSteps.length === 1 ? '' : 's'})`}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {(stage === 'running' || stage === 'done') && run ? (
        <RunView
          run={run}
          stage={stage}
          busy={busy}
          onStop={() => void stop()}
          onUndo={() => void undoAll()}
          onKeep={() => onOpenChange(false)}
          onOpenCopy={() => {
            onOpenProfile(run.profileId);
            onOpenChange(false);
          }}
        />
      ) : null}
    </Modal>
  );
}

function ChooseMode({
  onFixAll,
  onChange,
  onCreate,
}: {
  onFixAll: () => void;
  onChange: () => void;
  onCreate: () => void;
}) {
  const card =
    'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition';
  return (
    <div className="space-y-2.5">
      <button
        type="button"
        onClick={onFixAll}
        className={cn(
          card,
          'border-accent-border bg-bg-sunken hover:bg-accent-subtle',
        )}
      >
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
        <span>
          <span className="block text-sm font-semibold text-text-primary">
            Fix all issues
          </span>
          <span className="mt-0.5 block text-xs text-text-tertiary">
            Clears your CV&rsquo;s issue list in one go and shows the score
            before and after.
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onChange}
        className={cn(
          card,
          'border-accent-border bg-bg-sunken hover:bg-accent-subtle',
        )}
      >
        <PenLine className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
        <span>
          <span className="block text-sm font-semibold text-text-primary">
            Change my CV
          </span>
          <span className="mt-0.5 block text-xs text-text-tertiary">
            Tailor it to a job, a new role, one page, or a more senior voice.
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onCreate}
        className={cn(
          card,
          'border-accent-border bg-bg-sunken hover:bg-accent-subtle',
        )}
      >
        <FilePlus2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
        <span>
          <span className="block text-sm font-semibold text-text-primary">
            Quick create a CV
          </span>
          <span className="mt-0.5 block text-xs text-text-tertiary">
            From an old CV, a LinkedIn PDF, or a few questions.
          </span>
        </span>
      </button>
    </div>
  );
}

function CreateForm({
  request,
  onRequest,
  file,
  onFile,
  draft,
  onDraft,
  onBack,
  onNext,
}: {
  request: CvAutopilotRequest;
  onRequest: (next: CvAutopilotRequest) => void;
  file: File | null;
  onFile: (file: File | null) => void;
  draft: AnswersDraft;
  onDraft: (next: AnswersDraft) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const problem = createProblem(request, file, draft);
  const set = (patch: Partial<AnswersDraft>) => onDraft({ ...draft, ...patch });
  const source = request.createSource ?? 'upload';
  const tab = (id: 'upload' | 'answers', label: string) => (
    <button
      type="button"
      aria-pressed={source === id}
      onClick={() => onRequest({ ...request, createSource: id })}
      className={cn(
        'flex-1 rounded-lg px-3 py-2 text-[13px] font-semibold transition',
        source === id
          ? 'bg-accent-solid text-text-on-accent'
          : 'text-text-secondary hover:text-text-primary',
      )}
    >
      {label}
    </button>
  );
  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="autopilot-target-role"
          className="mb-1.5 block text-[13px] font-medium text-text-secondary"
        >
          Which role is this CV for?
        </label>
        <input
          id="autopilot-target-role"
          type="text"
          value={request.targetRole ?? ''}
          maxLength={120}
          onChange={(e) =>
            onRequest({ ...request, targetRole: e.target.value })
          }
          placeholder="e.g. Frontend Engineer"
          className={cn(fieldClass, 'h-10')}
        />
      </div>

      <div className="flex gap-1 rounded-xl border border-border-subtle bg-bg-sunken p-1">
        {tab('upload', 'Upload my CV or LinkedIn PDF')}
        {tab('answers', 'Answer a few questions')}
      </div>

      {source === 'upload' ? (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-bg-sunken px-4 py-6 text-center hover:border-accent-border">
          <FilePlus2 className="h-6 w-6 text-accent-text" aria-hidden />
          <span className="mt-2 text-[13px] font-medium text-text-primary">
            {file ? file.name : 'Choose a PDF, Word or text file'}
          </span>
          <span className="mt-0.5 text-xs text-text-tertiary">
            On LinkedIn: your profile → More → Save to PDF.
          </span>
          <input
            type="file"
            aria-label="CV file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="sr-only"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <input
            aria-label="Full name"
            value={draft.fullName}
            maxLength={120}
            onChange={(e) => set({ fullName: e.target.value })}
            placeholder="Full name"
            className={cn(fieldClass, 'h-10')}
          />
          <input
            aria-label="Email"
            value={draft.email ?? ''}
            maxLength={200}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="Email (optional)"
            className={cn(fieldClass, 'h-10')}
          />
          <input
            aria-label="Current or latest job title"
            value={draft.jobTitle}
            maxLength={120}
            onChange={(e) => set({ jobTitle: e.target.value })}
            placeholder="Current or latest job title"
            className={cn(fieldClass, 'h-10')}
          />
          <input
            aria-label="Company"
            value={draft.company}
            maxLength={120}
            onChange={(e) => set({ company: e.target.value })}
            placeholder="Company"
            className={cn(fieldClass, 'h-10')}
          />
          <input
            aria-label="Start date"
            value={draft.startDate ?? ''}
            maxLength={40}
            onChange={(e) => set({ startDate: e.target.value })}
            placeholder="Started (e.g. Jan 2023)"
            className={cn(fieldClass, 'h-10')}
          />
          <label className="flex h-10 items-center gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#17B26A]"
              checked={draft.current ?? false}
              onChange={(e) => set({ current: e.target.checked })}
            />
            I still work here
          </label>
          <textarea
            aria-label="Achievements"
            value={draft.achievementsText}
            rows={3}
            maxLength={1600}
            onChange={(e) => set({ achievementsText: e.target.value })}
            placeholder="2–3 things you achieved there, one per line (numbers help: 'Cut load time by 40%')"
            className={cn(fieldClass, 'resize-y sm:col-span-2')}
          />
          <input
            aria-label="Skills"
            value={draft.skillsText}
            maxLength={1200}
            onChange={(e) => set({ skillsText: e.target.value })}
            placeholder="Skills, separated by commas"
            className={cn(fieldClass, 'h-10 sm:col-span-2')}
          />
          <input
            aria-label="Degree"
            value={draft.degree ?? ''}
            maxLength={160}
            onChange={(e) => set({ degree: e.target.value })}
            placeholder="Degree (optional)"
            className={cn(fieldClass, 'h-10')}
          />
          <input
            aria-label="School"
            value={draft.school ?? ''}
            maxLength={160}
            onChange={(e) => set({ school: e.target.value })}
            placeholder="School (optional)"
            className={cn(fieldClass, 'h-10')}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <p className="text-xs text-text-tertiary">
          {problem ?? 'Uses only what you give it. Nothing is made up.'}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="border border-border-subtle"
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={problem !== null}
            onClick={onNext}
          >
            See the plan
          </Button>
        </div>
      </div>
    </div>
  );
}

function GoalForm({
  request,
  onRequest,
  keepOriginal,
  onKeepOriginal,
  onBack,
  onNext,
}: {
  request: CvAutopilotRequest;
  onRequest: (next: CvAutopilotRequest) => void;
  keepOriginal: boolean;
  onKeepOriginal: (keep: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const problem = goalProblem(request);
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {GOALS.map((g) => {
          const active = request.goal === g.id;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                onRequest({ ...request, goal: g.id });
                onKeepOriginal(g.keepOriginalByDefault);
              }}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                active
                  ? 'border-accent-solid bg-accent-subtle'
                  : 'border-border-subtle bg-bg-sunken hover:border-border-default',
              )}
            >
              <span className="block text-[13px] font-semibold text-text-primary">
                {g.label}
              </span>
              <span className="mt-0.5 block text-xs text-text-tertiary">
                {g.hint}
              </span>
            </button>
          );
        })}
      </div>

      {request.goal === 'tailor_job' ? (
        <textarea
          aria-label="Job description"
          value={request.jobDescription ?? ''}
          maxLength={8000}
          rows={6}
          onChange={(e) =>
            onRequest({ ...request, jobDescription: e.target.value })
          }
          placeholder="Paste the job description here"
          className={cn(fieldClass, 'resize-y')}
        />
      ) : null}
      {request.goal === 'change_role' ? (
        <input
          aria-label="Role to target"
          type="text"
          value={request.targetRole ?? ''}
          maxLength={120}
          onChange={(e) =>
            onRequest({ ...request, targetRole: e.target.value })
          }
          placeholder="e.g. Product Manager"
          className={cn(fieldClass, 'h-10')}
        />
      ) : null}
      {request.goal === 'custom' ? (
        <textarea
          aria-label="What to change"
          value={request.customGoal ?? ''}
          maxLength={1000}
          rows={3}
          onChange={(e) =>
            onRequest({ ...request, customGoal: e.target.value })
          }
          placeholder="e.g. Make it sound friendlier and less formal"
          className={cn(fieldClass, 'resize-y')}
        />
      ) : null}

      <label className="flex items-start gap-2.5 text-[13px] text-text-secondary">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[#17B26A]"
          checked={keepOriginal}
          onChange={(e) => onKeepOriginal(e.target.checked)}
        />
        <span>Keep my original CV and save this as a new copy</span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <p className="text-xs text-text-tertiary">
          {problem ?? 'Uses only facts already in your CV.'}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className="border border-border-subtle"
            onClick={onBack}
          >
            Back
          </Button>
          <Button
            type="button"
            variant="accent"
            disabled={problem !== null}
            onClick={onNext}
          >
            See the plan
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProPanel() {
  return (
    <div className="rounded-xl border border-accent-border bg-accent-subtle p-5 text-center">
      <Wand2 className="mx-auto h-7 w-7 text-accent-text" />
      <p className="mt-2 text-sm font-semibold text-text-primary">
        Autopilot is part of Pro
      </p>
      <p className="mt-1 text-xs text-text-secondary">
        Tell it the job and it fixes, tailors or builds your CV for you, saved
        as one version you can undo.
      </p>
      <Link
        href="/#pricing"
        className="mt-4 inline-flex h-9 items-center rounded-lg bg-accent-solid px-4 text-sm font-semibold text-text-on-accent"
      >
        See Pro
      </Link>
    </div>
  );
}

function PlanStepRow({
  step,
  included,
  onToggle,
  fact,
  onFact,
}: {
  step: CvAutopilotStep;
  included: boolean;
  onToggle: (include: boolean) => void;
  fact: string;
  onFact: (value: string) => void;
}) {
  const ruledOut = step.status === 'skipped_by_you';
  return (
    <li className={cn('px-3.5 py-3', ruledOut && 'opacity-60')}>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[#17B26A]"
          checked={included && !ruledOut}
          disabled={ruledOut}
          onChange={(e) => onToggle(e.target.checked)}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-text-primary">
            <span className="text-text-tertiary">
              {sectionLabel(step.section)} ·{' '}
            </span>
            {step.title}
          </span>
          <span className="mt-0.5 block text-xs text-text-secondary">
            {ruledOut ? 'Skipped, as you asked.' : step.detail}
          </span>
        </span>
      </label>
      {step.status === 'needs_input' && step.question && included ? (
        <div className="ml-7 mt-2">
          <p className="text-xs text-warning-text">{step.question}</p>
          <input
            type="text"
            value={fact}
            maxLength={300}
            onChange={(e) => onFact(e.target.value)}
            placeholder="e.g. 40% faster, 12k users"
            className={cn(fieldClass, 'mt-1.5 h-9')}
          />
        </div>
      ) : null}
    </li>
  );
}

function RunView({
  run,
  stage,
  busy,
  onStop,
  onUndo,
  onKeep,
  onOpenCopy,
}: {
  run: CvAutopilotRun;
  stage: Stage;
  busy: boolean;
  onStop: () => void;
  onUndo: () => void;
  onKeep: () => void;
  onOpenCopy: () => void;
}) {
  const active = run.steps.filter(
    (s) => s.status !== 'skipped_by_you' && s.status !== 'needs_input',
  );
  const settled = active.filter(
    (s) => s.status !== 'planned' && s.status !== 'running',
  ).length;
  const applied = run.steps.filter((s) => s.status === 'applied').length;
  const needsInput = run.steps.filter((s) => s.status === 'needs_input');
  const pct =
    active.length > 0 ? Math.round((settled / active.length) * 100) : 100;

  return (
    <div className="space-y-4">
      {stage === 'running' ? (
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-text-secondary">
            <span>
              {settled} of {active.length} done
            </span>
            <span>{run.stopping ? 'Stopping after this step…' : null}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full rounded-full bg-accent-solid transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          {run.mode === 'fix_all' || (run.mode === 'create' && !run.undone) ? (
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Score"
                before={run.scoreBefore}
                after={run.undone ? run.scoreBefore : run.scoreAfter}
              />
              <Metric
                label="Issues"
                before={run.issuesBefore}
                after={run.undone ? run.issuesBefore : run.issuesAfter}
                lowerIsBetter
              />
            </div>
          ) : null}
          {run.copy && !run.undone ? (
            <p className="rounded-xl border border-accent-border bg-accent-subtle px-3.5 py-3 text-[13px] text-text-primary">
              {run.mode === 'create' ? 'Your new CV: ' : 'Saved as a new CV: '}
              <span className="font-semibold">{run.copy.name}</span>.{' '}
              {run.mode === 'create'
                ? 'The CV you had open was not changed.'
                : 'Your original CV was not changed.'}
            </p>
          ) : null}
        </>
      )}

      <ul className="max-h-[42vh] divide-y divide-border-subtle overflow-y-auto rounded-xl border border-border-subtle">
        {run.steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3 px-3.5 py-2.5">
            <StepIcon status={step.status} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] text-text-primary">
                <span className="text-text-tertiary">
                  {sectionLabel(step.section)} ·{' '}
                </span>
                {step.title}
              </span>
              <span className="block text-xs text-text-tertiary">
                {STATUS_TEXT[step.status]}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {stage === 'done' && !run.undone && needsInput.length > 0 ? (
        <p className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning-text">
          {needsInput.length === 1
            ? '1 issue needs a detail only you know (like a real number). It is still in your Improvements list.'
            : `${needsInput.length} issues need a detail only you know (like a real number). They are still in your Improvements list.`}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-4">
        {stage === 'running' ? (
          <Button
            type="button"
            variant="ghost"
            className="border border-border-subtle"
            disabled={run.stopping}
            onClick={onStop}
          >
            {run.stopping ? 'Stopping…' : 'Stop'}
          </Button>
        ) : run.undone ? (
          <Button type="button" variant="accent" onClick={onKeep}>
            Close
          </Button>
        ) : (
          <>
            {applied > 0 || run.copy ? (
              <Button
                type="button"
                variant="ghost"
                className="border border-border-subtle"
                disabled={busy}
                onClick={onUndo}
              >
                {busy ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                {run.mode === 'create'
                  ? 'Delete this new CV'
                  : run.copy
                    ? 'Delete the copy'
                    : 'Undo all'}
              </Button>
            ) : null}
            {run.copy ? (
              <Button type="button" variant="accent" onClick={onOpenCopy}>
                Open the new CV
              </Button>
            ) : (
              <Button type="button" variant="accent" onClick={onKeep}>
                {applied > 0 ? 'Keep changes' : 'Close'}
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  before,
  after,
  lowerIsBetter = false,
}: {
  label: string;
  before: number | null;
  after: number | null;
  lowerIsBetter?: boolean;
}) {
  const better =
    before != null &&
    after != null &&
    (lowerIsBetter ? after < before : after > before);
  const unchanged = after != null && (before == null || before === after);
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-sunken p-3">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="mt-1 text-lg font-semibold text-text-primary">
        {unchanged ? (
          after
        ) : (
          <>
            {before ?? '—'}
            <span className="mx-1.5 text-text-tertiary">→</span>
            <span className={better ? 'text-success-text' : undefined}>
              {after ?? '…'}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
