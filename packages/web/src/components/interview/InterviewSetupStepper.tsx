'use client';

import '@/styles/interview-prep.css';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Check, Target } from 'lucide-react';

import { AdaptiveBadge } from '@/components/interview/AdaptiveBadge';
import { InterviewAvatar } from '@/components/interview/InterviewAvatar';
import { ProgressCoachPanel } from '@/components/interview/ProgressCoachPanel';
import {
  SimulationModeCard,
  type SimulationCardMode,
} from '@/components/interview/SimulationModeCard';
import { CoachingSetupControls } from '@/components/interview/coaching/CoachingControls';
import { SpeakingSpeedSlider } from '@/components/interview/SpeakingSpeedSlider';
import { ProgressTimeline } from '@/components/interview/results/ProgressTimeline';
import { useCVProfiles } from '@/hooks/useCVProfiles';
import {
  useCreateInterview,
  useInterviewSessions,
} from '@/hooks/useInterviews';
import {
  useCreateSimulateSession,
  useInterviewPrepProgress,
} from '@/hooks/useInterviewPrep';
import { api, type InterviewPersonality, type InterviewType } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { PersonaSelectorCard } from '@/components/interview/personality/PersonaSelectorCard';
import type {
  CoachingIntensity,
  InterviewMode,
} from '@/lib/interview-prep-types';
import { DEFAULT_COACHING_SETTINGS } from '@/lib/interview-prep-types';
import { scoreFromSessionWithCachedResult } from '@/lib/interviewDisplayScore';
import type { InterviewEvaluationPollState } from '@/lib/interviewEvaluationPoll';
import {
  INTERVIEW_PERSONAS,
  personaAvatarKey,
  type InterviewPersonaId,
} from '@/lib/interviewPersonas';
import { PERSONALITIES } from '@/lib/interviewPersonalities';
import { cn } from '@/lib/utils';

const TIP_LINES = [
  'Use a quiet space for Voice mode — background noise makes transcription unreliable; use Type if it is noisy',
  'Use specific examples from your experience',
  'Structure answers: Situation → Action → Result',
  "It's okay to pause and think before answering",
] as const;

const STEPS = ['Context', 'CV', 'Interviewer', 'Start'] as const;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function RecentSessionScore({
  row,
}: {
  row: import('@/lib/api').InterviewSession;
}) {
  const queryClient = useQueryClient();
  const cachedPoll = queryClient.getQueryData<InterviewEvaluationPollState>([
    'interview-result',
    row.id,
  ]);
  const displayScore = scoreFromSessionWithCachedResult(row, { cachedPoll });
  if (displayScore == null) {
    return <span className="text-xs text-[var(--text-teal)]">View →</span>;
  }
  return (
    <span className="rounded-[var(--radius-pill)] border border-[var(--border-teal)] bg-[var(--teal-10)] px-2.5 py-0.5 text-xs font-semibold text-[var(--text-teal)]">
      {displayScore}%
    </span>
  );
}

export function InterviewSetupStepper() {
  const router = useRouter();
  const params = useSearchParams();
  const profilesQ = useCVProfiles();
  const profiles = profilesQ.data?.rows ?? [];
  const sessionsQ = useInterviewSessions();
  const progressQ = useInterviewPrepProgress();
  const createInterview = useCreateInterview();
  const createSimulation = useCreateSimulateSession();

  const [step, setStep] = useState(0);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState(
    () => params.get('adaptive') !== '0',
  );
  const [simulationSelection, setSimulationSelection] =
    useState<SimulationCardMode | null>(null);
  const [simStressLevel, setSimStressLevel] = useState(2);
  const [questionTimeLimitSec, setQuestionTimeLimitSec] = useState(120);
  const [entryMode, setEntryMode] = useState<InterviewMode>('job_based');
  const [personality, setPersonality] = useState<InterviewPersonality>('alex');
  const [interviewPersona, setInterviewPersona] =
    useState<InterviewPersonaId>('friendly_coach');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [company, setCompany] = useState(params.get('company') ?? '');
  const [jobDescription, setJobDescription] = useState('');
  const [interviewType, setInterviewType] = useState<InterviewType>('mixed');
  const [totalQuestions, setTotalQuestions] = useState(7);
  const [speakingSpeed, setSpeakingSpeed] = useState(1);
  const [coachingEnabled, setCoachingEnabled] = useState(
    DEFAULT_COACHING_SETTINGS.enabled,
  );
  const [coachingIntensity, setCoachingIntensity] = useState<CoachingIntensity>(
    DEFAULT_COACHING_SETTINGS.intensity,
  );
  const [targetRoleTitle, setTargetRoleTitle] = useState(
    () => params.get('jobTitle')?.trim() ?? '',
  );
  const [startError, setStartError] = useState<string | null>(null);

  const jobAnalysisId = (params.get('jobAnalysisId') ?? '').trim();
  const lastAutoSelectedCvRef = useRef<string | null>(null);
  const lastAutoJobContextRef = useRef<string | null>(null);

  const linkedJobQ = useQuery({
    queryKey: ['job', jobAnalysisId],
    queryFn: () => api.jobs.getJob(jobAnalysisId),
    enabled: Boolean(jobAnalysisId),
  });

  const selectedAvatar = PERSONALITIES[personality];
  const selectedPersona = INTERVIEW_PERSONAS[interviewPersona];
  const selectedAvatarKey = personaAvatarKey(selectedPersona);
  const startTabGreeting =
    interviewPersona === 'silent_observer'
      ? `Hi, I'm ${selectedPersona.personName}. I'll observe while you answer — you'll receive full feedback after the session.`
      : selectedAvatar.greetingMessage;
  const historyRows = useMemo(
    () => (sessionsQ.data ?? []).slice(0, 3),
    [sessionsQ.data],
  );

  const effectiveCvId = useMemo(() => {
    if (selectedProfileId) return selectedProfileId;
    const def = profiles.find((p) => p.isDefault) ?? profiles[0];
    return def?.id ?? '';
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (selectedProfileId || profiles.length === 0) return;
    const def = profiles.find((p) => p.isDefault) ?? profiles[0];
    if (def) setSelectedProfileId(def.id);
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (!jobAnalysisId || !linkedJobQ.data) return;
    if (lastAutoJobContextRef.current === jobAnalysisId) return;
    const title = linkedJobQ.data.title?.trim();
    const comp = linkedJobQ.data.company?.trim();
    const desc = linkedJobQ.data.description?.trim();
    if (title && !targetRoleTitle.trim()) setTargetRoleTitle(title);
    if (comp && !company.trim()) setCompany(comp);
    if (desc && !jobDescription.trim()) setJobDescription(desc);
    setEntryMode('job_based');
    lastAutoJobContextRef.current = jobAnalysisId;
  }, [
    company,
    jobAnalysisId,
    jobDescription,
    linkedJobQ.data,
    targetRoleTitle,
  ]);

  useEffect(() => {
    if (
      !jobAnalysisId ||
      !linkedJobQ.data ||
      lastAutoSelectedCvRef.current === jobAnalysisId
    )
      return;
    const analysis = linkedJobQ.data.analysis as
      | Record<string, unknown>
      | undefined;
    const fromJob = [
      typeof analysis?.tailoredCvProfileId === 'string'
        ? analysis.tailoredCvProfileId
        : '',
      typeof analysis?.cvProfileId === 'string' ? analysis.cvProfileId : '',
    ]
      .map((s) => s.trim())
      .find((id) => id && profiles.some((p) => p.id === id));
    if (fromJob) {
      lastAutoSelectedCvRef.current = jobAnalysisId;
      setSelectedProfileId(fromJob);
    }
  }, [jobAnalysisId, linkedJobQ.data, profiles]);

  const canAdvanceStep0 =
    entryMode === 'role_based'
      ? targetRoleTitle.trim().length >= 2
      : jobDescription.trim().length >= 40 ||
        Boolean(jobAnalysisId) ||
        targetRoleTitle.trim().length >= 2;

  const startInterview = useCallback(() => {
    setStartError(null);
    if (!effectiveCvId) {
      setStartError(
        'Add a CV profile first — open CV Builder and create one, then return here.',
      );
      return;
    }
    const jd =
      jobDescription.trim() ||
      linkedJobQ.data?.description?.trim() ||
      params.get('jobDescription')?.trim() ||
      undefined;
    const inferredMode: InterviewMode =
      entryMode === 'job_based' || (jd && jd.length >= 40) || jobAnalysisId
        ? 'job_based'
        : 'role_based';

    if (simulationSelection) {
      createSimulation.mutate(
        {
          mode: simulationSelection,
          cvProfileId: effectiveCvId || undefined,
          jobAnalysisId: jobAnalysisId || undefined,
          jobTitle:
            targetRoleTitle.trim() ||
            linkedJobQ.data?.title?.trim() ||
            undefined,
          roleTitle: targetRoleTitle.trim() || undefined,
          company:
            company.trim() || linkedJobQ.data?.company?.trim() || undefined,
          jobDescription: jd,
          stressLevel: simStressLevel as 1 | 2 | 3 | 4 | 5,
          stressMode: true,
          questionTimeLimitSec,
          totalQuestions: Math.min(12, totalQuestions),
          personality: selectedPersona.legacyAvatar,
          interviewPersona:
            simulationSelection === 'hr_simulation'
              ? 'hr_interviewer'
              : 'strict_interviewer',
          speakingSpeed,
          coachingEnabled,
          coachingIntensity,
          coachingMode: 'real_time',
        },
        {
          onSuccess: (session) => {
            if (!session?.id) {
              setStartError(
                'Interview session was created but no session id was returned. Please try again.',
              );
              return;
            }
            try {
              sessionStorage.setItem(
                'applymate:interview:user-gesture',
                String(Date.now()),
              );
            } catch {
              /* ignore */
            }
            router.push(`/dashboard/interview/${session.id}`);
          },
          onError: (err) => {
            setStartError(getApiErrorMessage(err));
          },
        },
      );
      return;
    }

    createInterview.mutate(
      {
        cvProfileId: effectiveCvId || undefined,
        jobAnalysisId: jobAnalysisId || undefined,
        jobTitle:
          targetRoleTitle.trim() || linkedJobQ.data?.title?.trim() || undefined,
        roleTitle: targetRoleTitle.trim() || undefined,
        company:
          company.trim() || linkedJobQ.data?.company?.trim() || undefined,
        jobDescription: jd,
        interviewMode: inferredMode,
        interviewType,
        personality: selectedPersona.legacyAvatar,
        interviewPersona,
        speakingSpeed,
        totalQuestions,
        adaptiveDifficulty,
        prepMode: 'standard',
        coachingEnabled,
        coachingIntensity,
        coachingMode: 'real_time',
      },
      {
        onSuccess: (session) => {
          if (!session?.id) {
            setStartError(
              'Interview session was created but no session id was returned. Please try again.',
            );
            return;
          }
          try {
            sessionStorage.setItem(
              'applymate:interview:user-gesture',
              String(Date.now()),
            );
          } catch {
            /* ignore */
          }
          router.push(`/dashboard/interview/${session.id}`);
        },
        onError: (err) => {
          setStartError(getApiErrorMessage(err));
        },
      },
    );
  }, [
    company,
    createInterview,
    coachingEnabled,
    coachingIntensity,
    createSimulation,
    effectiveCvId,
    entryMode,
    interviewType,
    jobAnalysisId,
    jobDescription,
    linkedJobQ.data,
    params,
    interviewPersona,
    router,
    simStressLevel,
    simulationSelection,
    questionTimeLimitSec,
    adaptiveDifficulty,
    speakingSpeed,
    targetRoleTitle,
    totalQuestions,
  ]);

  const isStarting = createInterview.isPending || createSimulation.isPending;

  const goNext = () => {
    if (step === 0 && canAdvanceStep0) setStep(1);
    else if (step === 1 && profiles.length > 0) setStep(2);
    else if (step === 2) setStep(3);
  };

  return (
    <div className="ip-page mx-auto max-w-4xl space-y-6 pb-10 max-lg:px-1 sm:px-0">
      <header>
        <h1 className="text-[22px] font-bold text-[var(--text-primary)]">
          Interview Prep
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Practice until interviews feel easy.
        </p>
        <hr className="ip-divider" />
      </header>

      <ProgressCoachPanel />

      <section>
        <p className="ip-section-label">Simulation mode</p>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Pressure-based practice that overrides adaptive mode.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(['hr_simulation', 'senior_interviewer_simulation'] as const).map(
            (mode) => (
              <SimulationModeCard
                key={mode}
                mode={mode}
                selected={simulationSelection === mode}
                stressLevel={simStressLevel}
                onSelect={() =>
                  setSimulationSelection((prev) =>
                    prev === mode ? null : mode,
                  )
                }
                onStressChange={setSimStressLevel}
              />
            ),
          )}
        </div>
        {simulationSelection ? (
          <label className="mt-4 block max-w-[560px]">
            <span className="ip-label-field">
              Per-question time limit ({questionTimeLimitSec}s)
            </span>
            <input
              type="range"
              min={60}
              max={300}
              step={30}
              value={questionTimeLimitSec}
              onChange={(e) => setQuestionTimeLimitSec(Number(e.target.value))}
              className="ip-slider mt-2"
            />
          </label>
        ) : null}
      </section>

      <div
        id="interview-setup-wizard"
        className="ip-surface mx-auto max-w-[800px] overflow-hidden max-lg:rounded-2xl"
      >
        <div className="ip-wizard-header">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Interview preparation
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Practice with an AI interviewer tailored to your CV.
          </p>

          <p className="mt-4 text-[13px] font-medium text-[var(--text-teal)] sm:hidden">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>

          <nav
            className="ip-wizard-stepper hidden sm:flex"
            aria-label="Setup steps"
          >
            {STEPS.map((label, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => done && setStep(i)}
                  disabled={!done}
                  className={cn(
                    'ip-wizard-tab',
                    done && 'ip-wizard-tab-done',
                    active && 'ip-wizard-tab-active',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? (
                    <span className="ip-step-dot ip-step-dot-done" aria-hidden>
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'ip-step-dot',
                        active && 'ip-step-dot-active',
                      )}
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden lg:inline">{label}</span>
                  <span className="lg:hidden">{i + 1}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div key={step} className="ip-wizard-content ip-wizard-fade">
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                How should we tailor questions?
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    {
                      id: 'job_based' as const,
                      title: 'Job-based interview',
                      desc: 'Use a job description so questions match a real posting.',
                      Icon: Briefcase,
                    },
                    {
                      id: 'role_based' as const,
                      title: 'Role-based interview',
                      desc: 'Practice for a target role using your CV — no JD required.',
                      Icon: Target,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setEntryMode(opt.id)}
                    className={cn(
                      'ip-option-card',
                      entryMode === opt.id && 'ip-option-card-active',
                    )}
                  >
                    {entryMode === opt.id ? (
                      <span className="ip-option-check" aria-hidden>
                        <Check
                          className="h-3 w-3 text-[var(--bg-base)]"
                          strokeWidth={3}
                        />
                      </span>
                    ) : null}
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--teal-10)] text-[var(--text-teal)]">
                      <opt.Icon className="h-7 w-7" aria-hidden />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">
                      {opt.title}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      {opt.desc}
                    </p>
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="ip-label-field">Target role</span>
                <input
                  value={targetRoleTitle}
                  onChange={(e) => setTargetRoleTitle(e.target.value)}
                  className="ip-input"
                />
              </label>
              {entryMode === 'job_based' && (
                <>
                  <label className="block">
                    <span className="ip-label-field">Company (optional)</span>
                    <input
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="ip-input"
                    />
                  </label>
                  {!jobAnalysisId || !linkedJobQ.data?.description ? (
                    <label className="block">
                      <span className="ip-label-field">Job description</span>
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        rows={5}
                        className="ip-textarea mt-1.5"
                      />
                    </label>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      Using description from linked job analysis.
                    </p>
                  )}
                </>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {(['behavioral', 'technical', 'mixed'] as const).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInterviewType(id)}
                    className={cn(
                      'ip-chip capitalize',
                      interviewType === id && 'ip-chip-active',
                    )}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <label className="block">
                <span className="ip-label-field">CV profile</span>
                <select
                  value={effectiveCvId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="ip-input"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-[var(--text-muted)]">
                Default CV is used if none is selected.
              </p>
              <label className="block">
                <div className="mb-2.5 flex max-w-[560px] items-center justify-between">
                  <span className="text-[13px] font-medium text-[var(--text-primary)]">
                    Questions
                  </span>
                  <span className="text-[13px] font-semibold text-[var(--text-teal)]">
                    {totalQuestions}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={20}
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(Number(e.target.value))}
                  className="ip-slider"
                />
              </label>
              <SpeakingSpeedSlider
                value={speakingSpeed}
                onChange={setSpeakingSpeed}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <p className="text-[15px] font-semibold text-[var(--text-primary)]">
                  Choose your interviewer
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                  Personality shapes the session coaching tone and style.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(
                    Object.keys(INTERVIEW_PERSONAS) as InterviewPersonaId[]
                  ).map((id) => (
                    <PersonaSelectorCard
                      key={id}
                      personaId={id}
                      selected={interviewPersona === id}
                      onSelect={() => {
                        setInterviewPersona(id);
                        setPersonality(INTERVIEW_PERSONAS[id].legacyAvatar);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="mx-auto max-w-[640px] space-y-4">
              {!simulationSelection ? (
                <label className="ip-adaptive-card flex cursor-pointer items-start gap-3.5">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={adaptiveDifficulty}
                    onChange={(e) => setAdaptiveDifficulty(e.target.checked)}
                  />
                  <span
                    className={cn(
                      'ip-custom-check mt-0.5',
                      !adaptiveDifficulty && 'ip-custom-check-off',
                    )}
                    aria-hidden
                  >
                    {adaptiveDifficulty ? (
                      <Check
                        className="h-3.5 w-3.5 text-[var(--bg-base)]"
                        strokeWidth={3}
                      />
                    ) : null}
                  </span>
                  <span>
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      Adaptive mode
                      <AdaptiveBadge label="Recommended" />
                    </span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      Difficulty and focus areas adjust from your history — the
                      system targets weak spots.
                    </span>
                  </span>
                </label>
              ) : (
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Simulation mode uses stress settings above. Adaptive
                  difficulty is managed by the simulation engine.
                </p>
              )}
              <CoachingSetupControls
                settings={{
                  enabled: coachingEnabled,
                  intensity: coachingIntensity,
                  mode: 'real_time',
                }}
                onEnabledChange={setCoachingEnabled}
                onIntensityChange={setCoachingIntensity}
              />
              <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-5">
                <div className="flex items-start gap-4">
                  <InterviewAvatar
                    personality={selectedAvatarKey}
                    isSpeaking={false}
                    isListening={false}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">
                      {selectedPersona.personName}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {selectedPersona.roleLabel}
                    </p>
                    <p className="mt-2 text-sm italic leading-relaxed text-[var(--text-secondary)]">
                      {startTabGreeting}
                    </p>
                  </div>
                </div>
              </div>
              <p className="border-t border-[var(--border-subtle)] pt-3 text-xs text-[var(--text-muted)]">
                {selectedPersona.personName} · {totalQuestions} questions ·{' '}
                {speakingSpeed.toFixed(2)}× speed
              </p>
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] px-4 py-3.5">
                {TIP_LINES.map((tip) => (
                  <div key={tip} className="flex items-start gap-2 py-1.5">
                    <span className="ip-tip-bullet" aria-hidden />
                    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      {tip}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {startError ? (
          <p className="border-t border-[var(--border-subtle)] bg-rose-500/10 px-5 py-3 text-sm text-rose-200">
            {startError}
          </p>
        ) : step === 3 && !profilesQ.isLoading && !effectiveCvId ? (
          <p className="border-t border-[var(--border-subtle)] bg-amber-500/10 px-5 py-3 text-sm text-amber-100">
            Add a CV profile in CV Builder before starting — the button stays
            disabled until one is available.
          </p>
        ) : null}
        <footer className="ip-wizard-footer">
          {step > 0 ? (
            <button
              type="button"
              className="ip-btn-ghost"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button
              type="button"
              className="ip-btn-primary"
              disabled={
                (step === 0 && !canAdvanceStep0) ||
                (step === 1 && profiles.length === 0)
              }
              onClick={goNext}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="ip-btn-primary ip-btn-primary-lg"
              disabled={isStarting || profilesQ.isLoading || !effectiveCvId}
              onClick={startInterview}
              title={
                !effectiveCvId && !profilesQ.isLoading
                  ? 'Create a CV profile in CV Builder first'
                  : undefined
              }
            >
              {isStarting
                ? 'Starting…'
                : simulationSelection
                  ? 'Start simulation'
                  : adaptiveDifficulty
                    ? 'Start adaptive interview'
                    : `Start with ${selectedPersona.personName}`}
            </button>
          )}
        </footer>
      </div>

      {progressQ.data ? (
        <ProgressTimeline
          progress={progressQ.data}
          sessions={sessionsQ.data ?? []}
        />
      ) : null}

      <section>
        <div className="flex items-center justify-between gap-3">
          <p className="ip-section-label">Recent sessions</p>
          <button
            type="button"
            onClick={() => router.push('/dashboard/interview/history')}
            className="text-xs font-medium text-[var(--text-teal)] hover:underline"
          >
            View all →
          </button>
        </div>
        {historyRows.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            No sessions yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {historyRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => router.push(`/dashboard/interview/${row.id}`)}
                className="ip-session-row"
              >
                <InterviewAvatar
                  personality={row.personality}
                  isSpeaking={false}
                  isListening={false}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                    {row.jobTitle || 'Interview'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {formatWhen(row.createdAt)}
                  </p>
                </div>
                <RecentSessionScore row={row} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
