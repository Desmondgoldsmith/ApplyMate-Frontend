'use client';

import '@/styles/interview-prep.css';

import { useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AdaptiveBadge } from '@/components/interview/AdaptiveBadge';
import { SessionAdaptiveRail } from '@/components/interview/adaptive/SessionAdaptiveRail';
import { CoachHintToasts } from '@/components/interview/personalization/CoachHintToasts';
import { GrowthMiniPanel } from '@/components/interview/personalization/GrowthMiniPanel';
import { QuestionStyleBadge } from '@/components/interview/personalization/QuestionStyleBadge';
import { InterviewCoachTip } from '@/components/interview/InterviewCoachTip';
import { InterviewEmotionIndicator } from '@/components/interview/InterviewEmotionIndicator';
import { FollowUpBanner } from '@/components/interview/FollowUpBanner';
import { InterviewRoomAtmosphereLayer } from '@/components/interview/simulation/InterviewRoomAtmosphereLayer';
import { InterviewAvatar } from '@/components/interview/InterviewAvatar';
import { InterviewResultView } from '@/components/interview/InterviewResultView';
import { SessionPersonalityHeader } from '@/components/interview/personality/SessionPersonalityHeader';
import { InterviewerNudgeBanner } from '@/components/interview/InterviewerNudgeBanner';
import { PressureTimerBar } from '@/components/interview/PressureTimerBar';
import { InterviewerThinkingIndicator } from '@/components/interview/InterviewerThinkingIndicator';
import { TypingText } from '@/components/interview/TypingText';
import { InterviewVoiceBanner } from '@/components/interview/InterviewVoiceBanner';
import { useInterviewTTS } from '@/hooks/useInterviewTTS';
import { MobileExperienceBanner } from '@/components/dashboard/MobileExperienceBanner';
import { Button } from '@/components/ui/Button';
import {
  useAdaptiveProfile,
  useEnrichedPrepSession,
  useInterviewTurns,
  useSimulationState,
  useSkillProfile,
  useSubmitPracticeCoaching,
} from '@/hooks/useInterviewPrep';
import { useInterviewPrepFlow } from '@/hooks/useInterviewPrepFlow';
import {
  useInterviewResult,
  useInterviewSession,
  useRetryInterviewEvaluation,
  useSubmitInterviewAnswers,
} from '@/hooks/useInterviews';
import {
  buildLearningMoments,
  mergeSkillScores,
} from '@/lib/interviewPersonalization';
import type { FollowUpCoachingItem } from '@/lib/interviewCoachingFeedback';
import {
  canEndInterviewSession,
  normalizeQuestionText,
  resolveAnswerNavigationForChip,
  resolveAnsweredQuestionText,
  resolveNextPlannedNavigation,
} from '@/lib/interviewPrepNavigation';
import {
  INTERVIEW_ADAPTIVE_PROFILE_KEY,
  INTERVIEW_PREP_PROGRESS_KEY,
  resolveTurnCoaching,
  useInterviewPersonaMemory,
} from '@/hooks/useInterviewPersonaMemory';
import { useInterviewSimulationExperience } from '@/hooks/useInterviewSimulationExperience';
import { useSimulationTimer } from '@/hooks/useSimulationTimer';
import {
  InterviewVoiceProvider,
  type InterviewVoiceBridge,
} from '@/contexts/InterviewVoiceContext';
import { AnswerPanel } from '@/components/interview/session/AnswerPanel';
import {
  InterviewCoachingLayer,
  type InterviewCoachingApi,
} from '@/components/interview/coaching/InterviewCoachingLayer';
import { CoachingStickyToggle } from '@/components/interview/coaching/CoachingControls';
import { CoachingPanel } from '@/components/interview/session/CoachingPanel';
import { PrepQuestionProgress } from '@/components/interview/session/PrepQuestionProgress';
import { InterviewScoringCelebrationPanel } from '@/components/interview/InterviewScoringCelebrationPanel';
import { useCoachingSettings } from '@/hooks/useCoachingSettings';
import { IntroMicPrimeEffect } from '@/components/interview/session/IntroMicPrimeEffect';
import { InterviewNetworkNotice } from '@/components/interview/session/InterviewNetworkNotice';
import { QuestionReplayButton } from '@/components/interview/session/QuestionReplayButton';
import { SessionPersonaHeaderLive } from '@/components/interview/session/SessionPersonaHeaderLive';
import { SimulationPanel } from '@/components/interview/session/SimulationPanel';
import type { InterviewResult } from '@/lib/api';
import {
  ANALYZING_RESPONSE_LABEL,
  ANSWER_RECEIVED_LABEL,
  INTERVIEW_NEXT_QUESTION_PAUSE_MS,
  INTERVIEW_THINKING_DELAY_MS,
  isTurnAnswerLongEnough,
  sleep,
  TURN_ANSWER_MIN_CHARS,
} from '@/lib/interviewSpeech';
import {
  isNoValidTranscriptError,
  NO_VALID_TRANSCRIPT_USER_MESSAGE,
} from '@/lib/interviewTranscriptionErrors';
import {
  resolveCoachPersonality,
  COACH_PERSONALITIES,
} from '@/lib/coachPersonalities';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/axios';
import {
  buildSubmitAnswersFromTurns,
  isMainInterviewTurn,
  speakingSpeedStorageKey,
} from '@/lib/interviewTurnQueue';
import type { SimulationSignal } from '@/lib/interview-prep-types';
import { isSimulationMode } from '@/lib/interview-prep-types';
import {
  followUpHesitationMs,
  interruptionAlertDelayMs,
  questionLeadDelayMs,
  questionTypingDelayMs,
  simulationThinkingDelayMs,
  transitionPauseWithSimulation,
} from '@/lib/interviewSimulation';
import {
  trackInterviewPersonalityEffectObserved,
  trackInterviewPersonalityViewed,
} from '@/lib/interviewPersonaAnalytics';
import { clearInterviewCoachingCache } from '@/lib/interviewCoachingCache';
import { clearInterviewSessionCache } from '@/lib/interviewSessionCache';
import {
  interviewerGreetingMessage,
  personaAvatarKey,
  postInterviewThankYouMessage,
  resolveSessionPersona,
} from '@/lib/interviewPersonas';
import { cancelTurnSubmitsForSession } from '@/lib/interviewRequestDedupe';
import { interviewResultFromPoll } from '@/lib/interviewEvaluationPoll';
import {
  clearInterviewPendingResult,
  listPendingInterviewResults,
  markInterviewPendingResult,
} from '@/lib/interviewPendingResult';
import { resolveProcessingInsights } from '@/lib/interviewProcessingInsights';
import {
  normalizeInterviewPersonalityId,
  PERSONALITIES,
} from '@/lib/interviewPersonalities';
import { cn } from '@/lib/utils';

function simulationPressureLabel(
  pressureLevel: number,
  behavior: string | undefined,
): string {
  if (behavior === 'interrupting' || pressureLevel >= 4) return 'High pressure';
  if (behavior === 'strict' || pressureLevel >= 2) return 'Under review';
  return 'Normal';
}

type InterviewPhase =
  | 'loading'
  | 'intro'
  | 'questioning'
  | 'answering'
  | 'answer_feedback'
  | 'transitioning'
  | 'submitting'
  | 'submit_retry_wait'
  | 'processing'
  | 'results';

type LocalAnswer = {
  questionId: string;
  answerText: string;
  durationSeconds: number;
};

type PendingInterviewSubmission = {
  sessionId: string;
  answers: LocalAnswer[];
  savedAt: string;
};

type IntroStage = 'greeting' | 'self_intro';

/** Instant feedback while turn submit / transition runs (no new features). */
type AnswerPipelineStatus = 'idle' | 'submitting' | 'received' | 'analyzing';

function randomItem<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

const SCORING_POLL_MAX_MS = 3 * 60 * 1000;
const PENDING_SUBMISSION_STORAGE_KEY = 'applymate.interview.pendingSubmission';
const MAX_SUBMIT_RETRY_ATTEMPTS = 4;
const SUBMIT_RETRY_BASE_DELAY_MS = 4000;
const SUBMIT_RETRY_MAX_DELAY_MS = 30000;

function httpStatusFromUnknown(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) return error.response?.status;
  return undefined;
}

function isInterviewSessionExpired(error: unknown): boolean {
  if (httpStatusFromUnknown(error) === 410) return true;
  const msg = getApiErrorMessage(error).toLowerCase();
  return msg.includes('session expired') || msg.includes('session has expired');
}

function interviewEvaluationUserMessage(error: unknown): string {
  const status = httpStatusFromUnknown(error);
  const api = getApiErrorMessage(error);
  if (status === 410) {
    return 'This session has expired on the server. Start a new practice interview to continue.';
  }
  if (status === 404) {
    return 'We could not find this interview session. Check the link or start a new interview from the dashboard.';
  }
  if (status === 429) {
    return 'Too many scoring attempts right now. Please wait a few minutes and try again.';
  }
  if (api && api.trim()) return api;
  if (status === 503 || status === 502) {
    return 'We could not reach the scoring service. Check your connection, then try Retry scoring.';
  }
  return 'Something went wrong while loading your results. You can try Retry scoring or go back and start again.';
}

function isTurnAnswerTooShortError(error: unknown): boolean {
  if (isNoValidTranscriptError(error)) return true;
  const msg = getApiErrorMessage(error).toLowerCase();
  return (
    msg.includes('too short') ||
    msg.includes('missing or too short') ||
    getApiErrorCode(error) === 'ANSWER_TOO_SHORT'
  );
}

function shouldRetryInterviewSubmit(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return true;
  const status = error.response?.status;
  if (status === undefined) return true;
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function computeSubmitRetryDelayMs(attempt: number): number {
  const exponential = Math.min(
    SUBMIT_RETRY_MAX_DELAY_MS,
    SUBMIT_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
  );
  const jitter = Math.floor(Math.random() * 1200);
  return exponential + jitter;
}

export default function InterviewSessionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams<{ sessionId: string }>();
  const sessionId =
    typeof params.sessionId === 'string' ? params.sessionId : '';

  const sessionQ = useInterviewSession(sessionId || null);
  const submitAnswers = useSubmitInterviewAnswers(sessionId);
  const retryEvaluation = useRetryInterviewEvaluation(sessionId);
  const [phase, setPhase] = useState<InterviewPhase>('loading');
  const [introStage, setIntroStage] = useState<IntroStage>('greeting');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<LocalAnswer[]>([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [introText, setIntroText] = useState('');
  const [spokenCharIndex, setSpokenCharIndex] = useState<number | undefined>(
    undefined,
  );
  const [isMuted, setIsMuted] = useState(false);
  const [interviewerThinking, setInterviewerThinking] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const introMicPrimedRef = useRef(false);
  const initializedSessionIdRef = useRef<string | null>(null);
  /** Prevents repeated setPhase('results') + invalidate when result query / session updates churn deps. */
  const promotedInterviewToResultsRef = useRef(false);
  /** Prevents the submit effect from firing mutate more than once per submitting phase. */
  const submitInterviewInFlightRef = useRef(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [submitRetryAttempt, setSubmitRetryAttempt] = useState(0);
  const [submitRetryCountdown, setSubmitRetryCountdown] = useState<
    number | null
  >(null);
  const [retryEvaluationError, setRetryEvaluationError] = useState<
    string | null
  >(null);
  const hasAnnouncedScoringEtaRef = useRef(false);
  const hydratedPendingSubmissionRef = useRef(false);
  const submitRetryTimeoutRef = useRef<number | null>(null);
  const submitRetryCountdownIntervalRef = useRef<number | null>(null);
  /** Question text shown in the UI — frozen during answer_feedback so it cannot jump early. */
  const [displayedQuestionText, setDisplayedQuestionText] = useState('');
  const speakingFullTextRef = useRef('');
  const activeQuestionTextRef = useRef('');
  const speakingOnEndRef = useRef<(() => void) | null>(null);
  const pendingSpeakNextRef = useRef(false);
  const lastSpeakingSpeedRef = useRef(1);
  const pendingQuestionDifficultyRef = useRef(3);
  const lastSimulationSignalsRef = useRef<SimulationSignal[]>([]);

  const [mobileResponseOpen, setMobileResponseOpen] = useState(false);
  const [answerPipelineStatus, setAnswerPipelineStatus] =
    useState<AnswerPipelineStatus>('idle');
  const submitAnswerInFlightRef = useRef(false);
  const finishingInterviewRef = useRef(false);
  const resultQ = useInterviewResult(sessionId || null, phase === 'processing');

  const session = sessionQ.data;
  const sessionPersona = useMemo(
    () => (session ? resolveSessionPersona(session) : null),
    [session],
  );
  const prepMode = session?.prepMode;
  const usePrepSession = Boolean(session?.turns?.length);
  const enrichedQ = useEnrichedPrepSession(
    sessionId,
    Boolean(sessionId) && usePrepSession,
  );
  const turnsQ = useInterviewTurns(
    sessionId,
    Boolean(sessionId) &&
      usePrepSession &&
      phase !== 'loading' &&
      phase !== 'results',
  );
  const submitPracticeCoaching = useSubmitPracticeCoaching(sessionId || '');
  const coaching = useCoachingSettings(
    sessionId,
    session?.coachingSettings ?? enrichedQ.data?.coachingSettings,
  );
  const prep = useInterviewPrepFlow(session, {
    coachingEnabled: coaching.settings.enabled,
    requestCoachingOnSubmit: coaching.shouldRequestCoachingOnSubmit,
  });
  const skillProfileQ = useSkillProfile(prep.usePrep);
  const adaptiveProfileQ = useAdaptiveProfile(prep.usePrep);
  const isSimSession = isSimulationMode(prepMode);
  const simStateQ = useSimulationState(
    sessionId,
    Boolean(sessionId) &&
      isSimSession &&
      phase !== 'loading' &&
      phase !== 'results',
  );
  const questionTimeLimitSec =
    session?.questionTimeLimitSec ??
    simStateQ.data?.timer.questionTimeLimitSec ??
    0;
  const timerResetKey = prep.currentTurn?.id ?? currentQuestionIndex;
  const simTimer = useSimulationTimer(
    questionTimeLimitSec,
    isSimSession && (phase === 'answering' || phase === 'questioning'),
    timerResetKey,
  );
  const interviewPersonalityId = session
    ? normalizeInterviewPersonalityId(session.personality)
    : null;
  const personality = interviewPersonalityId
    ? PERSONALITIES[interviewPersonalityId]
    : null;
  const sessionGreetingMessage = useMemo(
    () =>
      sessionPersona
        ? interviewerGreetingMessage(sessionPersona)
        : (personality?.greetingMessage ?? PERSONALITIES.alex.greetingMessage),
    [personality?.greetingMessage, sessionPersona],
  );
  const coachId = session ? resolveCoachPersonality(session) : 'professional';
  const coachCfg = COACH_PERSONALITIES[coachId];
  const questionRows =
    session?.questions && Array.isArray(session.questions)
      ? session.questions
      : [];
  const currentQuestion = prep.usePrep
    ? prep.currentTurn
      ? {
          id: prep.currentTurn.questionId,
          question: prep.currentQuestionText,
          sectionTitle: undefined as string | undefined,
        }
      : undefined
    : questionRows[currentQuestionIndex];
  const [speakingSpeed, setSpeakingSpeed] = useState(1);

  /** Whisper upload only during active answer — not intro (avoids wrong turnId). */
  const whisperTurnId = useMemo(() => {
    if (!prep.usePrep || phase !== 'answering' || prep.activePracticeChip)
      return null;
    return prep.currentTurn?.id ?? null;
  }, [phase, prep.activePracticeChip, prep.currentTurn?.id, prep.usePrep]);

  useEffect(() => {
    if (turnsQ.data?.questionProgress) {
      prep.setQuestionProgress(turnsQ.data.questionProgress);
    }
  }, [prep.setQuestionProgress, turnsQ.data?.questionProgress]);

  const voiceBridgeRef = useRef<InterviewVoiceBridge | null>(null);
  const engineCoachingRef = useRef<InterviewCoachingApi | null>(null);

  const personaMemory = useInterviewPersonaMemory({
    sessionId: sessionId || null,
    session: session ?? null,
    enabled: Boolean(sessionId && session),
  });

  const interviewSim = useInterviewSimulationExperience({
    sessionId: sessionId || '',
    prepMode,
    enabled: Boolean(session),
    lastFeedback: prep.lastFeedback,
    simState: simStateQ.data,
  });

  const growthSkills = useMemo(
    () =>
      mergeSkillScores(
        skillProfileQ.data?.skills ?? adaptiveProfileQ.data?.skills ?? null,
        prep.lastPersonalization?.skills ?? null,
      ),
    [
      adaptiveProfileQ.data?.skills,
      prep.lastPersonalization?.skills,
      skillProfileQ.data?.skills,
    ],
  );

  const learningMoments = useMemo(
    () =>
      buildLearningMoments(
        prep.evolutionHistory,
        prep.lastPersonalization,
        personaMemory.previousComparison ??
          enrichedQ.data?.previousSessionComparison ??
          null,
      ),
    [
      enrichedQ.data?.previousSessionComparison,
      personaMemory.previousComparison,
      prep.evolutionHistory,
      prep.lastPersonalization,
    ],
  );

  const coachHintUrgency =
    prep.lastPersonalization?.realTimeSignals?.urgency ?? 'low';

  const answeredQuestionForFeedback = useMemo(
    () => resolveAnsweredQuestionText(prep.lastFeedback),
    [prep.lastFeedback],
  );

  const answerProcessingInsights = useMemo(
    () =>
      resolveProcessingInsights(prep.lastFeedback, {
        coachHints: prep.coachHints,
      }),
    [prep.coachHints, prep.lastFeedback],
  );

  const coachingAnswerProcessing = useMemo(() => {
    if (phase !== 'answer_feedback') return false;
    if (submitPracticeCoaching.isPending) return true;
    if (prep.practiceFeedback) return false;
    return (
      answerPipelineStatus === 'submitting' ||
      answerPipelineStatus === 'analyzing' ||
      prep.submitTurnPending
    );
  }, [
    answerPipelineStatus,
    phase,
    prep.practiceFeedback,
    prep.submitTurnPending,
    submitPracticeCoaching.isPending,
  ]);

  const [lastPracticeQuestionText, setLastPracticeQuestionText] = useState('');
  const [lastPracticeAnswerText, setLastPracticeAnswerText] = useState('');
  const [answeredSideQuestions, setAnsweredSideQuestions] = useState<string[]>(
    [],
  );
  const feedbackBeforePracticeRef = useRef<
    import('@/lib/interview-prep-types').TurnAnswerResponse | null
  >(null);

  const sideQuestionOnDisplay = useMemo(() => {
    const active = prep.activePracticeChip?.questionText?.trim();
    if (active) return active;
    if (prep.practiceFeedback && lastPracticeQuestionText.trim()) {
      return lastPracticeQuestionText.trim();
    }
    return '';
  }, [
    lastPracticeQuestionText,
    prep.activePracticeChip?.questionText,
    prep.practiceFeedback,
  ]);

  const interviewerQuestionText = useMemo(() => {
    if (phase === 'intro') {
      return introStage === 'greeting'
        ? sessionGreetingMessage
        : 'Introduce yourself';
    }
    if (
      sideQuestionOnDisplay &&
      (phase === 'answering' || phase === 'answer_feedback')
    ) {
      return sideQuestionOnDisplay;
    }
    if (phase === 'answer_feedback') {
      return (
        answeredQuestionForFeedback ||
        displayedQuestionText.trim() ||
        currentQuestion?.question ||
        'Preparing question...'
      );
    }
    return (
      displayedQuestionText.trim() ||
      currentQuestion?.question ||
      'Preparing question...'
    );
  }, [
    answeredQuestionForFeedback,
    currentQuestion?.question,
    displayedQuestionText,
    introStage,
    phase,
    sessionGreetingMessage,
    sideQuestionOnDisplay,
  ]);

  const [simReactionVisible, setSimReactionVisible] = useState(false);

  const registerAnsweredSideQuestion = useCallback((questionText: string) => {
    const key = normalizeQuestionText(questionText);
    if (!key) return;
    setAnsweredSideQuestions((prev) =>
      prev.includes(key) ? prev : [...prev, key],
    );
  }, []);

  const sidePracticeAnsweredCount = answeredSideQuestions.length;

  useEffect(() => {
    if (!interviewSim.active || phase !== 'answer_feedback') {
      setSimReactionVisible(false);
      return;
    }
    if (interviewerThinking) {
      setSimReactionVisible(false);
      return;
    }
    const turnKey = prep.lastFeedback?.turn?.id;
    if (!turnKey) return;
    const t = setTimeout(() => setSimReactionVisible(true), 1100);
    return () => clearTimeout(t);
  }, [
    interviewSim.active,
    interviewerThinking,
    phase,
    prep.lastFeedback?.turn?.id,
  ]);

  const adaptiveSpeakingSpeed =
    speakingSpeed *
    personaMemory.toneAdjustments.speakingSpeedMultiplier *
    (interviewSim.active ? interviewSim.pacingMultiplier : 1);
  const voiceRate = (personality?.voiceRate ?? 1) * adaptiveSpeakingSpeed;
  const voicePitch = personality?.voicePitch ?? 1;

  /** ElevenLabs /speech expects legacy avatar ids (alex, sarah, …), not UX persona ids. */
  const interviewTtsPersona = useMemo(() => {
    if (sessionPersona) return String(personaAvatarKey(sessionPersona));
    return personality?.id ?? 'alex';
  }, [personality?.id, sessionPersona]);

  const ttsSessionId = (session?.id ?? sessionId) || null;

  const interviewTTS = useInterviewTTS({
    sessionId: ttsSessionId,
    interviewPersona: interviewTtsPersona,
    /** ElevenLabs API speed — use session slider only (adaptive multiplier is for browser STT rate). */
    speakingSpeed,
    voiceName: personality?.voiceName,
    voiceRate,
    voicePitch,
  });

  const interviewTtsRef = useRef(interviewTTS);
  interviewTtsRef.current = interviewTTS;
  const interviewTtsStopRef = useRef(interviewTTS.stop);
  interviewTtsStopRef.current = interviewTTS.stop;
  const stopVoiceCapture = useCallback(() => {
    voiceBridgeRef.current?.stop();
  }, []);
  const stopVoiceCaptureRef = useRef(stopVoiceCapture);
  stopVoiceCaptureRef.current = stopVoiceCapture;

  const turnCoaching = useMemo(
    () => resolveTurnCoaching(prep.lastFeedback?.coaching, personaMemory),
    [personaMemory, prep.lastFeedback?.coaching],
  );

  useEffect(() => {
    if (!session?.id) return;
    const base = session.speakingSpeed ?? 1;
    try {
      const stored = window.localStorage.getItem(
        speakingSpeedStorageKey(session.id),
      );
      const parsed = stored ? Number(stored) : base;
      setSpeakingSpeed(Number.isFinite(parsed) ? parsed : base);
    } catch {
      setSpeakingSpeed(base);
    }
  }, [session?.id, session?.speakingSpeed]);

  useEffect(() => {
    if (!session?.id) return;
    try {
      window.localStorage.setItem(
        speakingSpeedStorageKey(session.id),
        String(speakingSpeed),
      );
    } catch {
      /* ignore */
    }
  }, [session?.id, speakingSpeed]);

  useEffect(() => {
    if (!prep.lastFeedback?.interruption) return;
    interviewTtsStopRef.current();
  }, [prep.lastFeedback?.interruption]);

  const personalityViewedRef = useRef(false);
  const personalityEffectTurnRef = useRef<string | null>(null);
  useEffect(() => {
    if (!session?.id || !sessionPersona || personalityViewedRef.current) return;
    personalityViewedRef.current = true;
    trackInterviewPersonalityViewed({
      sessionId: session.id,
      personality: sessionPersona.id,
      mode: session.prepMode ?? 'standard',
    });
  }, [session?.id, session?.prepMode, sessionPersona]);

  useEffect(() => {
    if (!session?.id || !sessionPersona || !prep.lastFeedback) return;
    const turnId = prep.lastFeedback.turn?.id;
    if (!turnId || personalityEffectTurnRef.current === turnId) return;
    personalityEffectTurnRef.current = turnId;
    const effect = prep.lastFeedback.interruption
      ? 'interruption'
      : prep.followUpReason
        ? 'follow_up'
        : undefined;
    trackInterviewPersonalityEffectObserved({
      sessionId: session.id,
      personality: sessionPersona.id,
      mode: session.prepMode ?? 'standard',
      effect,
      turnId,
    });
  }, [
    prep.followUpReason,
    prep.lastFeedback,
    session?.id,
    session?.prepMode,
    sessionPersona,
  ]);

  useEffect(() => {
    const followUpQ = prep.followUpReason?.question?.trim();
    if (phase === 'answer_feedback' && followUpQ) {
      interviewTTS.prefetch(followUpQ);
    }
  }, [interviewTTS.prefetch, phase, prep.followUpReason?.question]);

  /** Prefetch Q1 only after intro — avoids extra /speech while greeting plays. */
  useEffect(() => {
    if (!ttsSessionId || phase !== 'intro' || introStage !== 'self_intro')
      return;
    const firstQ = prep.currentQuestionText.trim();
    if (firstQ) interviewTTS.prefetch(firstQ);
  }, [
    introStage,
    interviewTTS.prefetch,
    phase,
    prep.currentQuestionText,
    ttsSessionId,
  ]);

  const currentQuestionSectionTitle =
    currentQuestion &&
    'sectionTitle' in currentQuestion &&
    typeof currentQuestion.sectionTitle === 'string'
      ? currentQuestion.sectionTitle
      : '';
  const sessionStatus = (session?.status ?? '') as string;
  const scoringPollMaxSeconds = Math.floor(SCORING_POLL_MAX_MS / 1000);

  const answerPipelineLabel = useMemo(() => {
    switch (answerPipelineStatus) {
      case 'submitting':
        return 'Processing answer…';
      case 'received':
        return ANSWER_RECEIVED_LABEL;
      case 'analyzing':
        return ANALYZING_RESPONSE_LABEL;
      default:
        return null;
    }
  }, [answerPipelineStatus]);

  const persistPendingSubmission = useCallback(
    (payload: PendingInterviewSubmission) => {
      try {
        window.localStorage.setItem(
          PENDING_SUBMISSION_STORAGE_KEY,
          JSON.stringify(payload),
        );
      } catch {
        // Ignore storage write errors; submit still proceeds.
      }
    },
    [],
  );

  const clearPendingSubmission = useCallback((expectedSessionId?: string) => {
    try {
      const raw = window.localStorage.getItem(PENDING_SUBMISSION_STORAGE_KEY);
      if (!raw) return;
      if (!expectedSessionId) {
        window.localStorage.removeItem(PENDING_SUBMISSION_STORAGE_KEY);
        return;
      }
      const parsed = JSON.parse(raw) as PendingInterviewSubmission;
      if (parsed?.sessionId === expectedSessionId) {
        window.localStorage.removeItem(PENDING_SUBMISSION_STORAGE_KEY);
      }
    } catch {
      window.localStorage.removeItem(PENDING_SUBMISSION_STORAGE_KEY);
    }
  }, []);

  const speakQuestionText = useCallback(
    (text: string, fromCharIndex = 0) => {
      const clean = text.trim();
      if (!clean) return;
      speakingFullTextRef.current = clean;
      activeQuestionTextRef.current = clean;
      const slice = fromCharIndex > 0 ? clean.slice(fromCharIndex) : clean;
      if (!slice.trim()) return;

      if (isMuted) {
        activeQuestionTextRef.current = clean;
        setDisplayedQuestionText(clean);
        setPhase('answering');
        setStartTime(new Date());
        return;
      }

      lastSpeakingSpeedRef.current = voiceRate;
      setPhase('questioning');
      const leadPauseMs = isSimSession
        ? questionLeadDelayMs(pendingQuestionDifficultyRef.current)
        : undefined;
      interviewTTS.clearPlaybackIssue();
      void interviewTTS.speak(slice, {
        leadPauseMs,
        advanceOnUnavailable: true,
        onBoundary: (charIndex) =>
          setSpokenCharIndex(fromCharIndex + charIndex),
        onEnd: () => {
          speakingOnEndRef.current?.();
          setPhase('answering');
          setStartTime(new Date());
        },
      });
    },
    [interviewTTS, isMuted, isSimSession, voiceRate],
  );

  const beginQuestion = useCallback(
    (questionText?: string) => {
      if (!session) return;
      const text =
        questionText?.trim() ?? currentQuestion?.question?.trim() ?? '';
      if (!text) return;
      setDisplayedQuestionText(text);
      setSpokenCharIndex(undefined);
      setAnswerPipelineStatus('idle');
      voiceBridgeRef.current?.reset();
      setTypedAnswer('');
      speakingOnEndRef.current = null;
      speakQuestionText(text, 0);
    },
    [currentQuestion?.question, session, speakQuestionText],
  );

  const replayQuestion = useCallback(() => {
    const v = voiceBridgeRef.current;
    if (interviewTTS.isSpeaking || v?.isRecording) return;
    stopVoiceCapture();
    speakingOnEndRef.current = null;

    if (
      phase === 'intro' &&
      introStage === 'greeting' &&
      sessionGreetingMessage
    ) {
      interviewTTS.stop();
      void (async () => {
        await interviewTTS.speak(sessionGreetingMessage, {
          skipLeadPause: true,
          advanceOnUnavailable: true,
        });
        await interviewTTS.speak(
          'Before we start, could you please introduce yourself? Tell me your name, your current role or background, and what brings you here today.',
          { skipLeadPause: true, advanceOnUnavailable: true },
        );
      })();
      return;
    }

    const text =
      activeQuestionTextRef.current.trim() ||
      displayedQuestionText.trim() ||
      prep.currentQuestionText.trim();
    if (!text) return;
    speakQuestionText(text, 0);
  }, [
    displayedQuestionText,
    introStage,
    interviewTTS,
    phase,
    prep.currentQuestionText,
    sessionGreetingMessage,
    speakQuestionText,
    stopVoiceCapture,
  ]);

  useEffect(() => {
    if (!sessionId) return;
    return () => {
      cancelTurnSubmitsForSession(sessionId);
      clearInterviewSessionCache(sessionId);
      clearInterviewCoachingCache(sessionId);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setPhase('loading');
    hydratedPendingSubmissionRef.current = false;
    initializedSessionIdRef.current = null;
    hasAnnouncedScoringEtaRef.current = false;
    promotedInterviewToResultsRef.current = false;
    submitInterviewInFlightRef.current = false;
    setSubmitRetryAttempt(0);
    setSubmitRetryCountdown(null);
    setSubmitError(null);
    setSessionExpired(false);
    if (submitRetryTimeoutRef.current) {
      window.clearTimeout(submitRetryTimeoutRef.current);
      submitRetryTimeoutRef.current = null;
    }
    if (submitRetryCountdownIntervalRef.current) {
      window.clearInterval(submitRetryCountdownIntervalRef.current);
      submitRetryCountdownIntervalRef.current = null;
    }
  }, [sessionId]);

  useEffect(() => {
    finishingInterviewRef.current = false;
    initializedSessionIdRef.current = null;
    promotedInterviewToResultsRef.current = false;
    hasAnnouncedScoringEtaRef.current = false;
    pendingSpeakNextRef.current = false;
  }, [sessionId]);

  useEffect(() => {
    if (!session?.id) return;

    const sessionChanged = initializedSessionIdRef.current !== session.id;
    if (sessionChanged) {
      initializedSessionIdRef.current = session.id;
      introMicPrimedRef.current = false;
      personalityViewedRef.current = false;
      personalityEffectTurnRef.current = null;
      promotedInterviewToResultsRef.current = false;
      submitInterviewInFlightRef.current = false;
      if (submitRetryTimeoutRef.current) {
        window.clearTimeout(submitRetryTimeoutRef.current);
        submitRetryTimeoutRef.current = null;
      }
      if (submitRetryCountdownIntervalRef.current) {
        window.clearInterval(submitRetryCountdownIntervalRef.current);
        submitRetryCountdownIntervalRef.current = null;
      }
      setIntroStage('greeting');
      setIntroText('');
      setDisplayedQuestionText('');
      setSpokenCharIndex(undefined);
      setCurrentQuestionIndex(0);
      setAnswers([]);
      voiceBridgeRef.current?.reset();
      setTypedAnswer('');
      setSubmitRetryAttempt(0);
      setSubmitRetryCountdown(null);
    }

    if (
      (sessionStatus === 'completed' ||
        sessionStatus === 'evaluation_failed') &&
      session.result
    ) {
      clearPendingSubmission(session.id);
      clearInterviewPendingResult(session.id);
      const resultKey = ['interview-result', session.id] as const;
      const cached = queryClient.getQueryData(resultKey) as
        | { status?: string }
        | undefined;
      if (cached?.status !== 'completed') {
        queryClient.setQueryData(resultKey, {
          status: 'completed',
          result: session.result,
        });
      }
      if (phase !== 'results') {
        promotedInterviewToResultsRef.current = true;
        setPhase('results');
      }
      return;
    }

    if (sessionStatus === 'evaluation_failed' && !session.result) {
      clearPendingSubmission(session.id);
      if (sessionChanged) {
        setWaitSeconds(0);
        setPhase('processing');
      }
      hasAnnouncedScoringEtaRef.current = false;
      return;
    }

    if (sessionChanged) {
      const resumedScoring = listPendingInterviewResults().some(
        (p) => p.sessionId === session.id,
      );
      if (resumedScoring && !session.result) {
        markInterviewPendingResult(
          session.id,
          session.jobTitle ?? session.company ?? undefined,
        );
        setPhase('processing');
        hasAnnouncedScoringEtaRef.current = false;
        return;
      }
      prep.syncQueueFromSession();
      const hasAnsweredTurns = Boolean(
        session.turns?.some(
          (t) => t.status === 'answered' || t.status === 'evaluated',
        ),
      );
      if (
        !finishingInterviewRef.current &&
        session.status === 'in_progress' &&
        hasAnsweredTurns
      ) {
        const pendingTurns = (session.turns ?? [])
          .filter((t) => t.status === 'pending')
          .filter(isMainInterviewTurn)
          .sort((a, b) => a.order - b.order);
        const resumeQ = pendingTurns[0]?.questionText?.trim() ?? '';
        if (resumeQ) {
          hasAnnouncedScoringEtaRef.current = true;
          setIntroStage('self_intro');
          setDisplayedQuestionText(resumeQ);
          activeQuestionTextRef.current = resumeQ;
          pendingSpeakNextRef.current = true;
          setPhase('questioning');
          return;
        }
      }
      setPhase('intro');
      hasAnnouncedScoringEtaRef.current = false;
    }
  }, [
    clearPendingSubmission,
    phase,
    prep,
    prep.syncQueueFromSession,
    queryClient,
    session,
    sessionStatus,
  ]);

  useEffect(() => {
    if (sessionQ.isError && isInterviewSessionExpired(sessionQ.error)) {
      setSessionExpired(true);
      interviewTtsStopRef.current();
      stopVoiceCaptureRef.current();
    }
  }, [sessionQ.error, sessionQ.isError]);

  useEffect(() => {
    const currentSessionId = session?.id;
    if (!currentSessionId || hydratedPendingSubmissionRef.current) return;
    hydratedPendingSubmissionRef.current = true;
    if (
      sessionStatus === 'completed' ||
      sessionStatus === 'evaluation_failed'
    ) {
      clearPendingSubmission(currentSessionId);
      return;
    }
    if (sessionStatus !== 'in_progress') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(PENDING_SUBMISSION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PendingInterviewSubmission;
      if (
        !parsed ||
        parsed.sessionId !== currentSessionId ||
        !Array.isArray(parsed.answers) ||
        parsed.answers.length === 0
      ) {
        return;
      }
      setAnswers(parsed.answers);
      setSubmitError(null);
      finishingInterviewRef.current = true;
      setPhase('submitting');
    } catch {
      clearPendingSubmission(currentSessionId);
    }
  }, [clearPendingSubmission, session?.id, sessionStatus]);

  useEffect(() => {
    if (
      phase !== 'intro' ||
      introStage !== 'greeting' ||
      !session ||
      !sessionPersona ||
      !ttsSessionId
    ) {
      return;
    }
    if (!interviewTTS.speechApisReady) return;

    const greeting = interviewerGreetingMessage(sessionPersona);
    const introPrompt =
      'Before we start, could you please introduce yourself? Tell me your name, your current role or background, and what brings you here today.';

    let cancelled = false;

    const runIntroSpeech = async () => {
      const tts = interviewTtsRef.current;
      if (isMuted) {
        if (!cancelled) setIntroStage('self_intro');
        return;
      }

      tts.clearPlaybackIssue();

      await tts.speak(greeting, {
        skipLeadPause: true,
        advanceOnUnavailable: true,
      });
      if (cancelled) return;

      await tts.speak(introPrompt, {
        skipLeadPause: true,
        advanceOnUnavailable: true,
      });
      if (cancelled) return;

      setIntroStage('self_intro');
    };

    void runIntroSpeech();

    return () => {
      cancelled = true;
    };
  }, [
    introStage,
    interviewTTS.speechApisReady,
    isMuted,
    phase,
    session,
    sessionPersona,
    ttsSessionId,
  ]);

  const feedbackLineForAnswer = useCallback(
    (answer: string) => {
      const normalized = answer.toLowerCase();
      const hasNumbers = /\d/.test(normalized);
      const hasConcreteSignals =
        hasNumbers ||
        normalized.includes('example') ||
        normalized.includes('because') ||
        normalized.includes('result') ||
        normalized.includes('impact') ||
        normalized.includes('improved');
      if (answer.trim().length > 120 || hasConcreteSignals) {
        return (
          randomItem(personality?.encouragementPhrases ?? []) ??
          'Great answer. That was clear and detailed.'
        );
      }
      return (
        randomItem(personality?.encouragementPhrases ?? []) ??
        'Nice start. Let us build on that with the next question.'
      );
    },
    [personality],
  );

  useEffect(() => {
    if (phase !== 'transitioning' || !personality) return;
    const latestAnswer = answers[answers.length - 1]?.answerText ?? '';
    const feedbackLine: string = feedbackLineForAnswer(latestAnswer);
    const phrase =
      randomItem(personality.transitionPhrases) ?? 'Next question.';

    if (isMuted) {
      const t = window.setTimeout(() => beginQuestion(), 700);
      return () => window.clearTimeout(t);
    }

    void interviewTTS.speak(feedbackLine, {
      advanceOnUnavailable: true,
      onEnd: () => {
        void interviewTTS.speak(phrase, {
          advanceOnUnavailable: true,
          onEnd: beginQuestion,
        });
      },
    });
  }, [
    answers,
    beginQuestion,
    feedbackLineForAnswer,
    interviewTTS.speak,
    isMuted,
    personality,
    phase,
  ]);

  useEffect(() => {
    if (phase === 'intro' && introStage === 'self_intro') {
      setStartTime(new Date());
    }
  }, [introStage, phase]);

  useEffect(() => {
    if (
      phase !== 'processing' ||
      !resultQ.data ||
      promotedInterviewToResultsRef.current
    )
      return;
    if (resultQ.data.status === 'failed') {
      setRetryEvaluationError(resultQ.data.message);
      return;
    }
    if (resultQ.data.status !== 'completed') return;
    promotedInterviewToResultsRef.current = true;
    clearInterviewPendingResult(sessionId);
    setPhase('results');
    queueMicrotask(() => {
      void queryClient.invalidateQueries({
        queryKey: ['interview-session', sessionId],
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: INTERVIEW_ADAPTIVE_PROFILE_KEY,
      });
      void queryClient.invalidateQueries({
        queryKey: INTERVIEW_PREP_PROGRESS_KEY,
      });
    });
  }, [phase, queryClient, resultQ.data, sessionId]);

  useEffect(() => {
    if (phase !== 'processing') return;
    setWaitSeconds(0);
    setRetryEvaluationError(null);
    const timer = window.setInterval(() => {
      setWaitSeconds((s) => s + 1);
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'processing') return;
    const poll = window.setInterval(() => {
      void resultQ.refetch();
    }, 3000);
    return () => {
      window.clearInterval(poll);
    };
  }, [phase, resultQ]);

  useEffect(() => {
    if (phase !== 'submitting' || !session?.id) return;
    if (submitInterviewInFlightRef.current) return;
    submitInterviewInFlightRef.current = true;
    setSubmitError(null);
    setSubmitRetryCountdown(null);
    persistPendingSubmission({
      sessionId: session.id,
      answers,
      savedAt: new Date().toISOString(),
    });
    submitAnswers.mutate(
      { answers, idempotencyKey: `finish-${session.id}` },
      {
        onSuccess: () => {
          submitInterviewInFlightRef.current = false;
          if (submitRetryTimeoutRef.current) {
            window.clearTimeout(submitRetryTimeoutRef.current);
            submitRetryTimeoutRef.current = null;
          }
          if (submitRetryCountdownIntervalRef.current) {
            window.clearInterval(submitRetryCountdownIntervalRef.current);
            submitRetryCountdownIntervalRef.current = null;
          }
          clearPendingSubmission(session.id);
          setSubmitRetryAttempt(0);
          setSubmitRetryCountdown(null);
          markInterviewPendingResult(
            session.id,
            session.jobTitle ?? session.company ?? undefined,
          );
          pendingSpeakNextRef.current = false;
          finishingInterviewRef.current = true;
          interviewTtsStopRef.current();
          setPhase('processing');
        },
        onError: (err) => {
          submitInterviewInFlightRef.current = false;
          const canRetry = shouldRetryInterviewSubmit(err);
          const nextAttempt = submitRetryAttempt + 1;
          if (canRetry && nextAttempt <= MAX_SUBMIT_RETRY_ATTEMPTS) {
            const delayMs = computeSubmitRetryDelayMs(nextAttempt);
            const delaySeconds = Math.max(1, Math.ceil(delayMs / 1000));
            setSubmitRetryAttempt(nextAttempt);
            setSubmitRetryCountdown(delaySeconds);
            setSubmitError(
              `Temporary network or service limit reached. Retrying submission automatically in ${delaySeconds}s (attempt ${nextAttempt}/${MAX_SUBMIT_RETRY_ATTEMPTS}).`,
            );
            if (submitRetryCountdownIntervalRef.current) {
              window.clearInterval(submitRetryCountdownIntervalRef.current);
            }
            submitRetryCountdownIntervalRef.current = window.setInterval(() => {
              setSubmitRetryCountdown((prev) => {
                if (prev === null || prev <= 1) return 0;
                return prev - 1;
              });
            }, 1000);
            if (submitRetryTimeoutRef.current) {
              window.clearTimeout(submitRetryTimeoutRef.current);
            }
            submitRetryTimeoutRef.current = window.setTimeout(() => {
              if (submitRetryCountdownIntervalRef.current) {
                window.clearInterval(submitRetryCountdownIntervalRef.current);
                submitRetryCountdownIntervalRef.current = null;
              }
              setSubmitRetryCountdown(null);
              setPhase('submitting');
            }, delayMs);
            setPhase('submit_retry_wait');
            return;
          }
          if (submitRetryCountdownIntervalRef.current) {
            window.clearInterval(submitRetryCountdownIntervalRef.current);
            submitRetryCountdownIntervalRef.current = null;
          }
          setSubmitRetryCountdown(null);
          if (isInterviewSessionExpired(err)) {
            setSessionExpired(true);
            finishingInterviewRef.current = false;
            return;
          }
          finishingInterviewRef.current = true;
          setSubmitError(getApiErrorMessage(err));
          setPhase('answer_feedback');
        },
      },
    );
  }, [
    answers,
    clearPendingSubmission,
    persistPendingSubmission,
    phase,
    session?.id,
    submitAnswers,
    submitRetryAttempt,
  ]);

  const postInterviewThankYouScript = useMemo(
    () =>
      sessionPersona
        ? postInterviewThankYouMessage(sessionPersona)
        : (personality?.postInterviewThankYou ?? ''),
    [personality?.postInterviewThankYou, sessionPersona],
  );

  useEffect(() => {
    if (phase !== 'submitting' && phase !== 'processing') return;
    if (hasAnnouncedScoringEtaRef.current) return;
    hasAnnouncedScoringEtaRef.current = true;
    pendingSpeakNextRef.current = false;
    if (isMuted || !postInterviewThankYouScript.trim()) return;
    void interviewTTS.speak(postInterviewThankYouScript, {
      skipLeadPause: true,
      advanceOnUnavailable: true,
    });
  }, [interviewTTS.speak, isMuted, phase, postInterviewThankYouScript]);

  useEffect(() => {
    if (phase !== 'submit_retry_wait') return;
    pendingSpeakNextRef.current = false;
    interviewTTS.stop();
  }, [interviewTTS, phase]);

  /** Teardown on leave — empty deps; do not depend on `interviewTTS` (new object every render → infinite stop loop). */
  useEffect(() => {
    return () => {
      if (submitRetryTimeoutRef.current) {
        window.clearTimeout(submitRetryTimeoutRef.current);
        submitRetryTimeoutRef.current = null;
      }
      if (submitRetryCountdownIntervalRef.current) {
        window.clearInterval(submitRetryCountdownIntervalRef.current);
        submitRetryCountdownIntervalRef.current = null;
      }
      interviewTtsStopRef.current();
      stopVoiceCaptureRef.current();
    };
  }, []);

  const leaveInterview = useCallback(() => {
    interviewTTS.stop();
    stopVoiceCapture();
    router.push('/dashboard/interview');
  }, [interviewTTS, router, stopVoiceCapture]);

  const leaveWhileScoring = useCallback(() => {
    if (!session?.id) return;
    markInterviewPendingResult(
      session.id,
      session.jobTitle ?? session.company ?? undefined,
    );
    pendingSpeakNextRef.current = false;
    finishingInterviewRef.current = true;
    interviewTTS.stop();
    stopVoiceCapture();
    router.push('/dashboard');
  }, [
    interviewTTS,
    router,
    session?.company,
    session?.id,
    session?.jobTitle,
    stopVoiceCapture,
  ]);

  const onRetryScoring = useCallback(() => {
    setRetryEvaluationError(null);
    setWaitSeconds(0);
    promotedInterviewToResultsRef.current = false;
    retryEvaluation.mutate(undefined, {
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: ['interview-result', sessionId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['interview-session', sessionId],
          exact: true,
        });
        void resultQ.refetch();
      },
      onError: (err) => {
        setRetryEvaluationError(interviewEvaluationUserMessage(err));
      },
    });
  }, [queryClient, resultQ, retryEvaluation, sessionId]);

  const finishPrepAndSubmit = useCallback(async () => {
    if (!session) return;
    prep.clearPractice();
    prep.setSelectedFollowUpQuestion(null);
    feedbackBeforePracticeRef.current = null;
    interviewTTS.stop();
    setSubmitError(null);
    finishingInterviewRef.current = true;
    pendingSpeakNextRef.current = false;
    setInterviewerThinking(false);
    setAnswerPipelineStatus('idle');

    const localMap = new Map(answers.map((a) => [a.questionId, a]));
    let turns = session.turns ?? [];
    let payload = buildSubmitAnswersFromTurns(
      turns,
      localMap,
      session.questions,
    );

    if (payload.length === 0) {
      const fresh = await sessionQ.refetch();
      turns = fresh.data?.turns ?? turns;
      payload = buildSubmitAnswersFromTurns(
        turns,
        localMap,
        fresh.data?.questions ?? session.questions,
      );
    }

    if (payload.length === 0) {
      finishingInterviewRef.current = false;
      setSubmitError(
        'No main answers to submit yet. Answer at least one main question, then end the interview.',
      );
      setPhase('answer_feedback');
      return;
    }

    persistPendingSubmission({
      sessionId: session.id,
      answers: payload,
      savedAt: new Date().toISOString(),
    });
    setAnswers(payload);
    setPhase('submitting');
  }, [
    answers,
    interviewTTS,
    persistPendingSubmission,
    prep,
    session,
    sessionQ,
  ]);

  const goToPrepQuestion = useCallback(
    (nav: { questionText?: string } | null | undefined) => {
      const text = nav?.questionText?.trim();
      if (!text) return false;
      finishingInterviewRef.current = false;
      setDisplayedQuestionText(text);
      activeQuestionTextRef.current = text;
      pendingSpeakNextRef.current = false;
      speakQuestionText(text, 0);
      return true;
    },
    [speakQuestionText],
  );

  const handleAnswerNextPlanned = useCallback(() => {
    const planned = resolveNextPlannedNavigation(prep.lastFeedback);
    if (!planned?.turnId) return;
    interviewTTS.stop();
    setInterviewerThinking(false);
    setAnswerPipelineStatus('idle');
    prep.setSelectedFollowUpQuestion(null);
    const nav = prep.startAnswerForNavigation(planned);
    goToPrepQuestion(nav);
  }, [goToPrepQuestion, interviewTTS, prep]);

  const handleAnswerFollowUp = useCallback(
    (item: FollowUpCoachingItem) => {
      interviewTTS.stop();
      setInterviewerThinking(false);
      setAnswerPipelineStatus('idle');
      setSubmitError(null);

      if (item.practiceOnly) {
        feedbackBeforePracticeRef.current = prep.lastFeedback;
        prep.beginPracticeChip({
          questionText: item.question,
          practiceOnly: true,
          parentQuestionText: item.parentQuestionText,
          contextLabel: item.contextLabel,
        });
        setLastPracticeQuestionText(item.question);
        prep.setSelectedFollowUpQuestion(item.question);
        setDisplayedQuestionText(item.question);
        activeQuestionTextRef.current = item.question;
        setTypedAnswer('');
        finishingInterviewRef.current = false;
        pendingSpeakNextRef.current = false;
        setPhase('answering');
        speakQuestionText(item.question, 0);
        return;
      }

      const navPayload = resolveAnswerNavigationForChip(
        prep.lastFeedback,
        item.question,
      );
      if (!navPayload?.turnId) {
        setSubmitError(
          'Could not start that follow-up. Try Next question or continue.',
        );
        return;
      }

      prep.setSelectedFollowUpQuestion(navPayload.questionText.trim());
      const nav = prep.startAnswerForNavigation(navPayload);
      goToPrepQuestion(nav);
    },
    [goToPrepQuestion, interviewTTS, prep, speakQuestionText],
  );

  const continueFromPractice = useCallback(() => {
    prep.clearPractice();
    setLastPracticeQuestionText('');
    setLastPracticeAnswerText('');
    interviewTTS.stop();
    pendingSpeakNextRef.current = false;
    setAnswerPipelineStatus('idle');
    setInterviewerThinking(false);
    prep.setSelectedFollowUpQuestion(null);
    const saved = feedbackBeforePracticeRef.current;
    if (saved) {
      prep.restoreFeedbackSnapshot(saved);
    }
    setPhase('answer_feedback');
  }, [interviewTTS, prep]);

  const continueAfterFeedback = useCallback(() => {
    prep.clearPractice();
    setLastPracticeQuestionText('');
    setLastPracticeAnswerText('');
    interviewTTS.stop();
    pendingSpeakNextRef.current = false;
    setAnswerPipelineStatus('analyzing');
    setInterviewerThinking(true);
    const basePauseMs = prep.usePrep
      ? personaMemory.toneAdjustments.transitionPauseMs
      : INTERVIEW_NEXT_QUESTION_PAUSE_MS;
    const transitionPauseMs = isSimSession
      ? transitionPauseWithSimulation(
          basePauseMs,
          lastSimulationSignalsRef.current,
        )
      : basePauseMs;
    void sleep(transitionPauseMs).then(() => {
      setInterviewerThinking(false);
      setAnswerPipelineStatus('idle');
      const feedbackSnapshot = prep.lastFeedback;
      void prep.advanceAfterFeedback().then((adv) => {
        if (!adv || adv.done) {
          if (canEndInterviewSession(prep.questionProgress, feedbackSnapshot)) {
            setPhase('answer_feedback');
            if (feedbackSnapshot)
              prep.restoreFeedbackSnapshot(feedbackSnapshot);
            return;
          }
          finishingInterviewRef.current = true;
          pendingSpeakNextRef.current = false;
          interviewTTS.stop();
          void finishPrepAndSubmit();
          return;
        }
        const nextQ =
          adv.questionText?.trim() || prep.currentQuestionText.trim();
        if (!nextQ) {
          pendingSpeakNextRef.current = true;
          setPhase('questioning');
          return;
        }
        finishingInterviewRef.current = false;
        setDisplayedQuestionText(nextQ);
        activeQuestionTextRef.current = nextQ;
        pendingSpeakNextRef.current = false;
        beginQuestion(nextQ);
      });
    });
  }, [
    finishPrepAndSubmit,
    interviewTTS,
    isSimSession,
    personaMemory.toneAdjustments.transitionPauseMs,
    prep,
    beginQuestion,
  ]);

  useEffect(() => {
    if (finishingInterviewRef.current) return;
    if (!pendingSpeakNextRef.current || phase === 'answer_feedback') return;
    if (
      phase === 'submitting' ||
      phase === 'processing' ||
      phase === 'submit_retry_wait'
    ) {
      return;
    }
    if (phase !== 'questioning' && phase !== 'answering') return;
    const text = prep.usePrep
      ? displayedQuestionText.trim() || prep.currentQuestionText
      : (questionRows[currentQuestionIndex]?.question ?? '');
    if (!text.trim()) return;
    pendingSpeakNextRef.current = false;
    const typingDelay = isSimSession
      ? questionTypingDelayMs(pendingQuestionDifficultyRef.current) +
        (prep.isFollowUp
          ? followUpHesitationMs(interviewSim.personaUi?.tone)
          : interviewSim.nextBehavior === 'interruption'
            ? interruptionAlertDelayMs()
            : 0)
      : 0;
    if (typingDelay > 0) {
      setInterviewerThinking(true);
      void sleep(typingDelay).then(() => {
        setInterviewerThinking(false);
        beginQuestion(text);
      });
      return;
    }
    beginQuestion(text);
  }, [
    beginQuestion,
    currentQuestionIndex,
    displayedQuestionText,
    isSimSession,
    phase,
    prep.currentQuestionText,
    interviewSim.nextBehavior,
    interviewSim.personaUi?.tone,
    prep.isFollowUp,
    prep.turnIndex,
    prep.usePrep,
    questionRows,
  ]);

  /** Live speed while the interviewer reads — Edge may not update rate in place, so restart from char offset. */
  useEffect(() => {
    const interviewerSpeaking =
      phase === 'questioning' ||
      (phase === 'intro' && introStage === 'greeting');
    const v = voiceBridgeRef.current;
    if (!interviewerSpeaking || isMuted || v?.isRecording || v?.isListening)
      return;
    if (Math.abs(lastSpeakingSpeedRef.current - voiceRate) < 0.01) return;
    const full = speakingFullTextRef.current;
    if (!full) return;
    const synthActive =
      interviewTTS.isSpeaking || interviewTTS.isSynthesisActive();
    if (!synthActive) {
      lastSpeakingSpeedRef.current = voiceRate;
      return;
    }

    if (interviewTTS.updateSpeakingRate(voiceRate)) {
      lastSpeakingSpeedRef.current = voiceRate;
      return;
    }

    const resumeAt = spokenCharIndex ?? 0;
    lastSpeakingSpeedRef.current = voiceRate;
    interviewTTS.stop();
    window.setTimeout(() => {
      speakQuestionText(full, resumeAt);
    }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introStage, interviewTTS, isMuted, phase, speakQuestionText, voiceRate]);

  const submitCurrentAnswer = () => {
    if (!session) return;
    if (submitAnswerInFlightRef.current || prep.submitTurnPending) return;

    const v = voiceBridgeRef.current;
    if (v?.inputMode === 'voice' && v.isRecording) {
      stopVoiceCapture();
    }

    if (v?.inputMode === 'voice' && v.transcriptionState === 'processing') {
      setSubmitError('Still transcribing your answer…');
      return;
    }

    if (v?.inputMode === 'voice' && v.transcriptionState === 'failed') {
      setSubmitError(
        v.transcriptionMessage ??
          'Could not understand clearly. Try again or type your answer.',
      );
      return;
    }

    const answerText = (
      v?.inputMode === 'voice' ? v.transcript : typedAnswer
    ).trim();
    if (!isTurnAnswerLongEnough(answerText)) {
      setSubmitError(
        `Please share a bit more detail (at least ${TURN_ANSWER_MIN_CHARS} characters).`,
      );
      return;
    }
    setSubmitError(null);

    if (phase === 'intro' && introStage === 'self_intro') {
      setIntroText(answerText);
      stopVoiceCapture();
      voiceBridgeRef.current?.reset();
      setTypedAnswer('');
      const begin = () => {
        voiceBridgeRef.current?.reset();
        setTypedAnswer('');
        setCurrentQuestionIndex(0);
        prep.syncQueueFromSession();
        const firstQ =
          prep.currentQuestionText.trim() || currentQuestion?.question?.trim();
        beginQuestion(firstQ || undefined);
      };
      if (isMuted) {
        begin();
        return;
      }
      if (prep.usePrep) {
        begin();
        return;
      }
      void interviewTTS.speak(
        "Great, thank you for sharing. Let's get started with the interview.",
        {
          advanceOnUnavailable: true,
          onEnd: begin,
        },
      );
      return;
    }

    if (!currentQuestion) return;
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - startTime.getTime()) / 1000),
    );

    if (prep.usePrep && prep.activePracticeChip && phase === 'answering') {
      interviewTTS.stop();
      stopVoiceCapture();
      submitAnswerInFlightRef.current = true;
      setAnswerPipelineStatus('submitting');
      setInterviewerThinking(true);
      setPhase('answer_feedback');
      const chip = prep.activePracticeChip;
      void submitPracticeCoaching
        .mutateAsync({
          questionText: chip.questionText,
          answerText,
          parentQuestionText: chip.parentQuestionText,
        })
        .then(async (res) => {
          submitAnswerInFlightRef.current = false;
          setLastPracticeQuestionText(chip.questionText);
          registerAnsweredSideQuestion(chip.questionText);
          prep.completePracticeAnswer(res);
          prep.setSelectedFollowUpQuestion(null);
          setLastPracticeAnswerText(answerText);
          setAnswerPipelineStatus('received');
          voiceBridgeRef.current?.reset();
          setTypedAnswer('');
          setPhase('answer_feedback');
          setAnswerPipelineStatus('analyzing');
          await sleep(INTERVIEW_THINKING_DELAY_MS);
          setInterviewerThinking(false);
          setAnswerPipelineStatus('idle');
        })
        .catch((err) => {
          submitAnswerInFlightRef.current = false;
          setAnswerPipelineStatus('idle');
          setInterviewerThinking(false);
          setPhase('answering');
          if (isInterviewSessionExpired(err)) {
            setSessionExpired(true);
            stopVoiceCapture();
            return;
          }
          setSubmitError(getApiErrorMessage(err));
        });
      return;
    }

    if (prep.usePrep && prep.currentTurn && phase === 'answering') {
      const expectedTurnId = prep.currentTurn.id;
      interviewTTS.stop();
      stopVoiceCapture();
      submitAnswerInFlightRef.current = true;
      setAnswerPipelineStatus('submitting');
      setInterviewerThinking(true);
      setPhase('answer_feedback');
      const questionShown =
        activeQuestionTextRef.current.trim() ||
        displayedQuestionText.trim() ||
        prep.currentQuestionText.trim();
      void prep
        .submitPrepAnswer(
          answerText,
          durationSeconds,
          voiceBridgeRef.current?.getAnswerSource(),
          expectedTurnId,
          questionShown,
        )
        .then(async (res) => {
          submitAnswerInFlightRef.current = false;
          if (!res) {
            setAnswerPipelineStatus('idle');
            setInterviewerThinking(false);
            return;
          }
          const scoredQ = res.answeredQuestion?.questionText?.trim();
          if (scoredQ) {
            setDisplayedQuestionText(scoredQ);
            activeQuestionTextRef.current = scoredQ;
          }
          setAnswerPipelineStatus('received');
          voiceBridgeRef.current?.reset();
          setTypedAnswer('');
          setAnswerPipelineStatus('analyzing');
          if (res.simulation) {
            pendingQuestionDifficultyRef.current =
              res.simulation.nextQuestionDifficulty;
            lastSimulationSignalsRef.current = res.simulation.signals;
          }
          const thinkingDelay = isSimSession
            ? simulationThinkingDelayMs(res.simulation?.signals ?? [])
            : INTERVIEW_THINKING_DELAY_MS;
          await sleep(thinkingDelay);
          setInterviewerThinking(false);
          setAnswerPipelineStatus('idle');
        })
        .catch((err) => {
          submitAnswerInFlightRef.current = false;
          setAnswerPipelineStatus('idle');
          setInterviewerThinking(false);
          setPhase('answering');
          if (isInterviewSessionExpired(err)) {
            setSessionExpired(true);
            stopVoiceCapture();
            return;
          }
          if (isTurnAnswerTooShortError(err)) {
            setSubmitError(
              isNoValidTranscriptError(err)
                ? NO_VALID_TRANSCRIPT_USER_MESSAGE
                : "We didn't catch enough of your answer — try speaking again or type your response.",
            );
            return;
          }
          const code = getApiErrorCode(err);
          if (code === 'QUESTION_TURN_MISMATCH') {
            setSubmitError(
              'That question is practice-only — use Answer this on the side question card, not Submit on the main turn.',
            );
            return;
          }
          if (code === 'TURN_ALREADY_ANSWERED') {
            setSubmitError(
              'This question was already submitted. Continue to the next step.',
            );
            return;
          }
          setSubmitError(getApiErrorMessage(err));
        });
      return;
    }

    const nextAnswers = [
      ...answers,
      { questionId: currentQuestion.id, answerText, durationSeconds },
    ];
    setAnswers(nextAnswers);
    voiceBridgeRef.current?.reset();
    setTypedAnswer('');
    const hasNext = currentQuestionIndex + 1 < questionRows.length;
    if (hasNext) {
      setCurrentQuestionIndex((idx) => idx + 1);
      setPhase('transitioning');
      return;
    }
    persistPendingSubmission({
      sessionId: session.id,
      answers: nextAnswers,
      savedAt: new Date().toISOString(),
    });
    setPhase('submitting');
  };

  if (sessionId && sessionQ.isError && !session) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#0C0F0F] px-6 py-12 text-center">
        <p className="text-sm font-semibold text-white">
          {isInterviewSessionExpired(sessionQ.error)
            ? 'This practice session has expired'
            : 'We could not load this interview'}
        </p>
        <p className="text-xs text-white/50">
          {isInterviewSessionExpired(sessionQ.error)
            ? 'Interview sessions are only kept for a limited time on the server. Start a new practice session to continue.'
            : getApiErrorMessage(sessionQ.error)}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {isInterviewSessionExpired(sessionQ.error) ? (
            <Button
              type="button"
              variant="primary"
              onClick={() => router.push('/dashboard/interview')}
            >
              Start new interview
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              onClick={() => void sessionQ.refetch()}
            >
              Try again
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/dashboard/interview/history')}
          >
            Back to history
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'loading' || sessionQ.isLoading || !session) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-white/60">
        Loading interview session...
      </div>
    );
  }

  if (
    questionRows.length === 0 &&
    phase !== 'processing' &&
    phase !== 'submitting' &&
    phase !== 'submit_retry_wait' &&
    phase !== 'results'
  ) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-[#0C0F0F] px-6 py-12 text-center">
        <p className="text-sm font-semibold text-white">
          Interview not ready yet
        </p>
        <p className="text-xs text-white/55">
          The server has not attached questions to this session. That often
          happens for a short time right after the session is created. Try
          refreshing—if it persists, start a new practice interview from
          Interview preparation.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => void sessionQ.refetch()}
          >
            Refresh
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/dashboard/interview/history')}
          >
            Back to history
          </Button>
        </div>
      </div>
    );
  }

  const prepMainTotal =
    prep.questionProgress?.mainTotal && prep.questionProgress.mainTotal > 0
      ? prep.questionProgress.mainTotal
      : session.totalQuestions;
  const total = prep.usePrep ? Math.max(prepMainTotal, 1) : questionRows.length;
  const questionCounter = prep.usePrep
    ? Math.min(
        prep.answeredCount + (phase === 'answer_feedback' ? 0 : 1),
        total,
      )
    : Math.min(currentQuestionIndex + 1, total);
  const progress =
    prep.usePrep && prep.questionProgress && prep.questionProgress.mainTotal > 0
      ? Math.round(
          (prep.questionProgress.mainAnswered /
            prep.questionProgress.mainTotal) *
            100,
        )
      : total > 0
        ? Math.round((questionCounter / total) * 100)
        : 0;
  const currentMainQuestionNumber =
    prep.currentTurn?.mainQuestionNumber ??
    prep.lastFeedback?.answeredQuestion?.mainQuestionNumber ??
    null;
  const activeTurnLabel = prep.activePracticeChip
    ? 'Side question (practice)'
    : prep.practiceFeedback && lastPracticeQuestionText
      ? 'Side question (practice)'
      : (prep.currentTurn?.label ?? null);
  const inIntroSelf = phase === 'intro' && introStage === 'self_intro';
  const showAdaptiveBadge =
    session.adaptiveDifficulty !== false && !isSimSession;
  const liveCoachMessage =
    (phase === 'answering'
      ? (interviewSim.nudgeMessage ?? simStateQ.data?.nudgeMessage)
      : null) ??
    prep.lastFeedback?.coachMessage ??
    '';
  const interruptionBannerVisible = Boolean(
    interviewSim.active &&
    (interviewSim.interruptionAlert ||
      (phase === 'questioning' && prep.isFollowUp)),
  );
  const interruptionBannerMessage =
    interviewSim.interruptionAlert ??
    (prep.isFollowUp ? 'Interviewer is following up…' : null);
  const pressureLabel = isSimSession
    ? simulationPressureLabel(
        simStateQ.data?.pressureLevel ?? session.stressLevel ?? 1,
        simStateQ.data?.interviewerBehavior,
      )
    : undefined;
  const adaptationNote = enrichedQ.data?.adaptation?.adaptationReason;

  const resultForView: InterviewResult | null | undefined =
    phase === 'results'
      ? (interviewResultFromPoll(resultQ.data) ?? session.result)
      : null;

  if (phase === 'results' && resultForView) {
    return (
      <InterviewResultView
        result={resultForView}
        session={session}
        onBackToInterviewList={() =>
          router.push('/dashboard/interview/history')
        }
        onPracticeAgain={() => router.push('/dashboard/interview')}
        onDone={() => router.push('/dashboard')}
      />
    );
  }

  const evaluationPollFailed =
    phase === 'processing' && resultQ.data?.status === 'failed';
  const resultPollError =
    phase === 'processing'
      ? evaluationPollFailed && resultQ.data?.status === 'failed'
        ? resultQ.data.message
        : resultQ.isError
          ? interviewEvaluationUserMessage(resultQ.error)
          : null
      : null;
  const showExpiredSession =
    phase === 'processing' &&
    resultQ.isError &&
    httpStatusFromUnknown(resultQ.error) === 410;
  const showEvaluationFailedWithoutResult =
    phase === 'processing' &&
    (sessionStatus === 'evaluation_failed' || evaluationPollFailed) &&
    !resultForView;
  const waitStateTitle =
    waitSeconds < 20
      ? 'Analysing your answers...'
      : waitSeconds < 60
        ? 'Still working on your results...'
        : waitSeconds <= scoringPollMaxSeconds
          ? 'Almost there...'
          : 'Taking longer than usual...';
  const estimatedWait =
    resultQ.data?.status === 'pending' && resultQ.data.estimatedWaitSeconds
      ? resultQ.data.estimatedWaitSeconds
      : null;
  const waitStateBody =
    estimatedWait && waitSeconds < 30
      ? `Usually ready in about ${estimatedWait} seconds — you can leave and check your dashboard.`
      : waitSeconds < 20
        ? 'This often takes about 30 to 90 seconds. Scoring runs in the background.'
        : waitSeconds < 60
          ? "We're evaluating each answer carefully"
          : waitSeconds <= scoringPollMaxSeconds
            ? 'Complex interviews take a moment to score'
            : 'Your results will be ready soon. You can also close this and check back.';
  const showRetryScoring =
    phase === 'processing' &&
    !showExpiredSession &&
    (showEvaluationFailedWithoutResult ||
      waitSeconds > scoringPollMaxSeconds ||
      (resultQ.isError && httpStatusFromUnknown(resultQ.error) !== 410));

  const jobTitle = (session.jobTitle ?? '').trim();
  const company = (session.company ?? '').trim();
  const jobDescription =
    (session as { jobDescription?: string }).jobDescription?.trim() ?? '';
  const hasJobContext = Boolean(jobTitle || company || jobDescription);

  const interviewerDisplayName =
    sessionPersona?.personName?.trim() || 'Interviewer';
  const interviewerFirstName =
    interviewerDisplayName.split(/\s+/)[0] ?? 'Interviewer';
  const isScoringPhase =
    phase === 'submitting' ||
    phase === 'submit_retry_wait' ||
    phase === 'processing';

  const networkNotice =
    sessionQ.isFetching && session
      ? 'Syncing session in the background — you can keep going.'
      : enrichedQ.isFetching && prep.usePrep && !enrichedQ.data
        ? 'Loading practice context…'
        : sessionQ.isError && session
          ? 'Connection issue — showing your last saved progress.'
          : null;

  return (
    <InterviewVoiceProvider
      bridgeRef={voiceBridgeRef}
      sessionId={sessionId || null}
      turnId={whisperTurnId}
      blocked={sessionExpired}
    >
      <IntroMicPrimeEffect
        phase={phase}
        introStage={introStage}
        interviewerAudioBusy={
          interviewTTS.isSpeaking || interviewTTS.isInterviewerAudioActive
        }
        voiceBridgeRef={voiceBridgeRef}
      />
      <div
        className={cn(
          'ip-page relative mx-auto flex h-full min-h-0 w-full min-w-0 max-w-[1400px] flex-col overflow-hidden',
          isScoringPhase && 'ip-page--scoring',
        )}
      >
        <MobileExperienceBanner
          surface="interview-prep"
          className="mx-3 mb-2 shrink-0 lg:mx-4 lg:hidden"
        />
        <InterviewRoomAtmosphereLayer
          active={isSimSession && interviewSim.active}
          atmosphere={interviewSim.atmosphere ?? 'calm'}
          pressureTier={interviewSim.pressureTier}
          className="ip-session-shell min-h-0 min-w-0 flex-1 overflow-hidden"
        >
          {sessionExpired ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
              role="dialog"
              aria-labelledby="session-expired-title"
            >
              <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0C0F0F] p-6 shadow-2xl">
                <h3
                  id="session-expired-title"
                  className="text-lg font-semibold text-white"
                >
                  This practice session has expired
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  The server no longer accepts answers for this session — that
                  usually happens after the session times out or the tab was
                  left open a long time. Your work on this device is not lost if
                  you still see your transcript; start a new interview to
                  continue practicing.
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="primary"
                    className="flex-1"
                    onClick={() => router.push('/dashboard/interview')}
                  >
                    Start new interview
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => router.push('/dashboard/interview/history')}
                  >
                    View history
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
          <InterviewNetworkNotice
            message={networkNotice}
            visible={Boolean(networkNotice)}
          />
          {submitError && !sessionExpired ? (
            <div className="shrink-0 rounded-t-2xl border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100/95">
              {submitError}
            </div>
          ) : null}

          {(phase === 'submitting' ||
            phase === 'submit_retry_wait' ||
            phase === 'processing') &&
          !showExpiredSession &&
          !showEvaluationFailedWithoutResult ? (
            <div className="ip-scoring-overlay absolute inset-0 rounded-2xl">
              <InterviewScoringCelebrationPanel
                phase={
                  phase === 'submit_retry_wait' ? 'submit_retry_wait' : phase
                }
                interviewerName={interviewerDisplayName}
                thankYouMessage={
                  postInterviewThankYouScript ||
                  `Thank you for completing the interview. Your personalised results are being prepared — usually within a minute. You can stay here or go to your dashboard and we will alert you when they are ready.`
                }
                sessionPersona={sessionPersona}
                processingTitle={
                  phase === 'processing' ? waitStateTitle : undefined
                }
                processingDescription={
                  phase === 'processing' ? waitStateBody : undefined
                }
                processingSteps={
                  phase === 'processing'
                    ? [
                        'Reviewing clarity, structure, and relevance across your answers',
                        'Building your readiness score and improvement plan',
                        'Saving results so you can review them anytime',
                      ]
                    : undefined
                }
                onLeaveToDashboard={leaveWhileScoring}
                footer={
                  <>
                    {phase === 'processing' &&
                    resultPollError &&
                    !showExpiredSession ? (
                      <p className="text-center text-xs text-amber-100/90">
                        {resultPollError}
                      </p>
                    ) : null}
                    {phase === 'processing' && retryEvaluationError ? (
                      <p className="text-center text-xs text-amber-100/90">
                        {retryEvaluationError}
                      </p>
                    ) : null}
                    {phase === 'processing' && showRetryScoring ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        disabled={retryEvaluation.isPending}
                        onClick={() => onRetryScoring()}
                      >
                        {retryEvaluation.isPending
                          ? 'Retrying…'
                          : 'Retry scoring'}
                      </Button>
                    ) : null}
                    {phase === 'processing' &&
                    waitSeconds > scoringPollMaxSeconds ? (
                      <button
                        type="button"
                        className="text-xs text-[#00C9B1] underline-offset-2 hover:underline"
                        onClick={() =>
                          router.push('/dashboard/interview/history')
                        }
                      >
                        Check interview history →
                      </button>
                    ) : null}
                  </>
                }
              />
            </div>
          ) : null}

          {(phase === 'submitting' ||
            phase === 'submit_retry_wait' ||
            phase === 'processing') &&
          (showExpiredSession || showEvaluationFailedWithoutResult) ? (
            <div className="ip-scoring-overlay absolute inset-0 rounded-2xl">
              {showExpiredSession ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="max-w-sm text-sm font-semibold text-white">
                    {resultPollError}
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    className="mt-1"
                    onClick={() => router.push('/dashboard/interview')}
                  >
                    Start a new interview
                  </Button>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="max-w-sm text-sm font-semibold text-white">
                    We had trouble scoring your interview. Please try again.
                  </p>
                  {retryEvaluationError ? (
                    <p className="max-w-sm text-xs text-amber-100/90">
                      {retryEvaluationError}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="primary"
                    className="mt-1"
                    disabled={retryEvaluation.isPending}
                    onClick={() => onRetryScoring()}
                  >
                    {retryEvaluation.isPending
                      ? 'Retrying…'
                      : 'Retry Evaluation →'}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-full lg:min-h-0 lg:flex-row">
            {/* Main stage (Meet: primary video area) */}
            <div className="ip-panel-left ip-live-split-left relative flex min-h-0 flex-1 flex-col overflow-hidden border-b border-[var(--border-subtle)] lg:min-h-0 lg:border-b-0 lg:border-r">
              <button
                type="button"
                className="ip-close-btn"
                aria-label="Leave interview"
                onClick={() => setShowExitModal(true)}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-y-contain pb-4 pt-12">
                {phase === 'intro' ? (
                  <div
                    className="mx-5 mb-2 rounded-[var(--radius-lg)] border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.08)] px-4 py-3"
                    role="note"
                  >
                    <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
                      <span className="font-semibold text-[var(--text-primary)]">
                        Quiet space recommended.
                      </span>{' '}
                      Voice answers work best without background noise. If you
                      are not in a quiet place, switch to{' '}
                      <span className="font-medium text-[var(--text-teal)]">
                        Type
                      </span>{' '}
                      in the response panel.
                    </p>
                  </div>
                ) : null}
                <div className="px-5">
                  {inIntroSelf ? (
                    <p className="pr-10 text-[13px] font-medium text-[var(--text-muted)]">
                      Introduction
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2 pr-10">
                        {prep.usePrep ? (
                          <PrepQuestionProgress
                            progress={prep.questionProgress}
                            currentMainQuestionNumber={
                              currentMainQuestionNumber
                            }
                            sidePracticeAnsweredCount={
                              sidePracticeAnsweredCount
                            }
                            turnLabel={activeTurnLabel}
                          />
                        ) : (
                          <p className="text-[13px] font-medium text-[var(--text-muted)]">
                            Question {questionCounter} of {total}
                          </p>
                        )}
                        {prep.usePrep &&
                        phase === 'answering' &&
                        !inIntroSelf ? (
                          <QuestionStyleBadge
                            hint={prep.pendingQuestionStyle}
                            fading={prep.questionStyleFading}
                          />
                        ) : null}
                      </div>
                      <div className="ip-progress-bar mt-2">
                        <div
                          className="ip-progress-fill"
                          style={{
                            width: `${phase === 'intro' ? (introStage === 'greeting' ? 10 : 22) : progress}%`,
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="mx-5 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
                  {sessionPersona ? (
                    <div className="mb-3.5 flex items-center gap-2">
                      <div className="relative">
                        <InterviewAvatar
                          personality={personaAvatarKey(sessionPersona)}
                          isSpeaking={interviewTTS.isSpeaking && !isMuted}
                          isListening={false}
                          size="sm"
                          demeanor={
                            interviewSim.active
                              ? interviewSim.avatarDemeanor
                              : 'neutral'
                          }
                        />
                        {interviewSim.active ? (
                          <InterviewEmotionIndicator
                            emotion={interviewSim.emotion}
                            compact
                            className="absolute -bottom-1 -right-1 shadow-sm"
                          />
                        ) : null}
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        {interviewerDisplayName}{' '}
                        {phase === 'intro' ? 'says:' : 'asks:'}
                        {isSimSession && interviewSim.active ? (
                          <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">
                            · adapted to your progress
                          </span>
                        ) : null}
                      </p>
                    </div>
                  ) : null}
                  <TypingText
                    text={interviewerQuestionText}
                    isActive={
                      phase === 'questioning' ||
                      (phase === 'intro' && introStage === 'greeting')
                    }
                    charIndex={spokenCharIndex}
                    className="text-left text-base font-medium leading-relaxed text-[var(--text-primary)]"
                  />
                  <QuestionReplayButton
                    visible={
                      (phase === 'answering' ||
                        inIntroSelf ||
                        (phase === 'intro' && introStage === 'greeting')) &&
                      Boolean(
                        displayedQuestionText.trim() ||
                        currentQuestion?.question?.trim() ||
                        sessionGreetingMessage,
                      )
                    }
                    onReplay={replayQuestion}
                    interviewerSpeaking={interviewTTS.isSpeaking}
                  />
                </div>

                {hasJobContext ? (
                  <div className="mx-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 py-3.5">
                    <p className="ip-section-label">Interview context</p>
                    <p className="mt-1.5 text-sm font-semibold text-[var(--text-primary)]">
                      {jobTitle || 'Interview practice'}
                      {company ? (
                        <span className="text-white/55"> · {company}</span>
                      ) : null}
                    </p>
                    {jobDescription ? (
                      <details className="mt-2 rounded-xl border border-white/10 bg-[#0B1010] px-3 py-2">
                        <summary className="cursor-pointer select-none text-xs font-semibold text-white/70">
                          Job description
                          <span className="ml-2 text-[11px] font-normal text-white/40">
                            (collapsed)
                          </span>
                        </summary>
                        <div className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-white/55">
                          {jobDescription}
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : null}

                {sessionPersona ? (
                  <SessionPersonaHeaderLive
                    persona={sessionPersona}
                    isSpeaking={interviewTTS.isSpeaking && !isMuted}
                    phase={phase}
                    prepMode={prepMode}
                    adaptiveOn={showAdaptiveBadge}
                  />
                ) : null}

                <SimulationPanel
                  isSimSession={isSimSession}
                  showAdaptiveBadge={showAdaptiveBadge}
                  interviewSim={interviewSim}
                  interruptionBannerVisible={interruptionBannerVisible}
                  interruptionBannerMessage={interruptionBannerMessage}
                  pressureLabel={pressureLabel}
                />

                {adaptationNote &&
                !prep.adaptiveSnapshot.session?.adaptationReason ? (
                  <p className="mx-5 text-[12px] italic text-[var(--text-muted)]">
                    {adaptationNote}
                  </p>
                ) : prep.adaptiveSnapshot.session?.adaptationReason ? (
                  <p className="mx-5 text-[12px] italic text-[var(--text-muted)]">
                    {prep.adaptiveSnapshot.session.adaptationReason}
                  </p>
                ) : null}
                {showAdaptiveBadge && personaMemory.toneAdjustments.moodHint ? (
                  <p className="mx-5 text-[11px] text-[var(--text-muted)]">
                    {personaMemory.toneAdjustments.moodHint}
                  </p>
                ) : null}
                {isSimSession && pressureLabel ? (
                  <p className="text-center text-[11px] font-semibold text-amber-200/90">
                    {pressureLabel}
                  </p>
                ) : null}

                {prep.isFollowUp &&
                !prep.activePracticeChip &&
                phase !== 'answer_feedback' ? (
                  <FollowUpBanner reason={prep.followUpReason?.reason} />
                ) : null}

                {!isMuted ? (
                  <InterviewVoiceBanner
                    issue={interviewTTS.playbackIssue}
                    onDismiss={interviewTTS.clearPlaybackIssue}
                    onRetryPremium={interviewTTS.retryLastSpeech}
                    onUseDeviceVoice={interviewTTS.useDeviceVoiceForLastLine}
                    deviceVoiceAvailable={
                      interviewTTS.isSpeechSynthesisSupported
                    }
                  />
                ) : null}

                {interviewerThinking ? (
                  <InterviewerThinkingIndicator
                    interviewerName={interviewerFirstName}
                    message={
                      isSimSession && phase === 'questioning'
                        ? `${interviewerFirstName} is preparing the next question…`
                        : isSimSession
                          ? `${interviewerFirstName} is thinking…`
                          : undefined
                    }
                  />
                ) : null}
              </div>
            </div>

            {/* Side panel: answer + actions (Meet: chat / controls rail) */}
            <div
              className={cn(
                'ip-panel-right ip-live-split-right flex min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden border-t border-[var(--border-subtle)] lg:min-h-0 lg:border-l lg:border-t-0',
                'max-sm:ip-panel-right-sheet',
                mobileResponseOpen && 'max-sm:ip-panel-right-sheet-open',
              )}
            >
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                {prep.usePrep && phase !== 'results' ? (
                  <div className="sticky top-0 z-10 flex justify-end border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-4 py-2 backdrop-blur-sm">
                    <CoachingStickyToggle
                      settings={coaching.settings}
                      disabled={coaching.isUpdating}
                      onToggle={() =>
                        coaching.setEnabled(!coaching.settings.enabled)
                      }
                    />
                  </div>
                ) : null}
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain px-0 pb-2">
                  {prep.usePrep && phase !== 'results' ? (
                    <GrowthMiniPanel
                      skills={growthSkills}
                      improvementTrend={
                        skillProfileQ.data?.improvementTrend ??
                        prep.lastPersonalization?.weaknessProfile?.trend
                      }
                      weaknessTrend={
                        prep.lastPersonalization?.weaknessProfile?.trend ??
                        adaptiveProfileQ.data?.weaknessTrend
                      }
                      topWeaknesses={
                        prep.lastPersonalization?.weaknessProfile
                          ?.topWeaknesses ??
                        skillProfileQ.data?.weaknessProfile?.topWeaknesses ??
                        adaptiveProfileQ.data?.lastWeaknesses
                      }
                    />
                  ) : null}

                  {coaching.settings.enabled &&
                  prep.coachHints.length > 0 &&
                  (phase === 'answer_feedback' || phase === 'answering') ? (
                    <CoachHintToasts
                      hints={prep.coachHints}
                      urgency={coachHintUrgency}
                    />
                  ) : null}

                  {isSimSession &&
                  simTimer.active &&
                  prep.adaptiveSnapshot.session?.recommendedDifficulty !==
                    'easy' ? (
                    <PressureTimerBar
                      remainingSec={simTimer.remaining}
                      limitSec={simTimer.limit}
                      ratio={simTimer.ratio}
                      isLow={
                        simTimer.isLow ||
                        interviewSim.signals.includes('TIME_DELAY_HIGH')
                      }
                      pressureLabel={pressureLabel}
                    />
                  ) : null}

                  {showAdaptiveBadge &&
                  prep.usePrep &&
                  (phase === 'answering' || phase === 'answer_feedback') ? (
                    <SessionAdaptiveRail
                      snapshot={prep.adaptiveSnapshot}
                      evolutionHistory={prep.evolutionHistory}
                      showEvolution={false}
                      difficultyPulse={prep.difficultyPulse}
                      className="border-b border-[var(--border-subtle)] pb-3"
                    />
                  ) : null}

                  {prep.usePrep &&
                  sessionId &&
                  prep.currentTurn?.id &&
                  !prep.activePracticeChip &&
                  !prep.practiceFeedback ? (
                    <InterviewCoachingLayer
                      sessionId={sessionId}
                      turnId={prep.currentTurn.id}
                      questionContext={prep.currentTurn.context}
                      phase={phase}
                      typedAnswer={typedAnswer}
                      elapsedSeconds={Math.max(
                        0,
                        Math.round((Date.now() - startTime.getTime()) / 1000),
                      )}
                      enabled={prep.usePrep && coaching.settings.enabled}
                      coachingRef={engineCoachingRef}
                    />
                  ) : null}

                  {sessionPersona &&
                  liveCoachMessage &&
                  phase === 'answering' ? (
                    <InterviewerNudgeBanner
                      persona={sessionPersona}
                      message={liveCoachMessage}
                    />
                  ) : null}

                  {phase === 'answering' ||
                  inIntroSelf ||
                  (phase === 'intro' && introStage === 'greeting') ? (
                    <div className="border-b border-[var(--border-subtle)] px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="ip-section-label">Your response</p>
                          <p className="mt-1 text-[15px] font-semibold text-[var(--text-primary)]">
                            {inIntroSelf
                              ? 'Introduce yourself'
                              : 'Answer this question'}
                          </p>
                        </div>
                        <QuestionReplayButton
                          visible={
                            (phase === 'answering' ||
                              inIntroSelf ||
                              (phase === 'intro' &&
                                introStage === 'greeting')) &&
                            Boolean(
                              displayedQuestionText.trim() ||
                              currentQuestion?.question?.trim() ||
                              sessionGreetingMessage,
                            )
                          }
                          onReplay={replayQuestion}
                          interviewerSpeaking={interviewTTS.isSpeaking}
                        />
                      </div>
                      {inIntroSelf && introText ? (
                        <p className="mt-1 text-xs text-white/40">
                          Intro captured: {introText.slice(0, 80)}
                          {introText.length > 80 ? '...' : ''}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <CoachingPanel
                    visible={Boolean(
                      phase === 'answer_feedback' &&
                      sessionPersona &&
                      coaching.showCoachingPanel &&
                      (prep.feedbackTurnId ||
                        coachingAnswerProcessing ||
                        prep.practiceFeedback),
                    )}
                    isSimSession={isSimSession}
                    interviewSim={interviewSim}
                    simReactionVisible={simReactionVisible}
                    prep={prep}
                    coaching={coaching}
                    sessionPersona={sessionPersona!}
                    lastFeedback={prep.lastFeedback}
                    feedbackTurnId={
                      prep.feedbackTurnId ?? prep.currentTurn?.id ?? 'coaching'
                    }
                    isProcessingAnswer={coachingAnswerProcessing}
                    processingInsights={answerProcessingInsights}
                    onContinue={continueAfterFeedback}
                    onContinueFromPractice={continueFromPractice}
                    onEndInterview={() => void finishPrepAndSubmit()}
                    answeredSideQuestions={answeredSideQuestions}
                    onAnswerFollowUp={handleAnswerFollowUp}
                    onAnswerNextPlanned={handleAnswerNextPlanned}
                    learningMoments={learningMoments}
                    practiceFeedback={prep.practiceFeedback}
                    practiceQuestionText={
                      prep.activePracticeChip?.questionText ||
                      lastPracticeQuestionText
                    }
                    practiceAnswerText={lastPracticeAnswerText}
                    onDismissPractice={() => {
                      prep.clearPractice();
                      setLastPracticeQuestionText('');
                      setLastPracticeAnswerText('');
                    }}
                  />

                  <AnswerPanel
                    phase={phase}
                    inIntroSelf={inIntroSelf}
                    typedAnswer={typedAnswer}
                    onTypedAnswerChange={setTypedAnswer}
                    answerPipelineLabel={answerPipelineLabel}
                    showSubmitSkeleton={false}
                    interviewerThinking={interviewerThinking}
                    submitTurnPending={prep.submitTurnPending}
                    answerPipelineStatus={answerPipelineStatus}
                    onSubmit={submitCurrentAnswer}
                    isMuted={isMuted}
                    onToggleMute={() => {
                      if (isMuted) {
                        setIsMuted(false);
                        return;
                      }
                      setIsMuted(true);
                      interviewTTS.stop();
                    }}
                    voiceProcessingStatus={
                      voiceBridgeRef.current?.isTranscribing
                        ? 'whisper'
                        : interviewTTS.isGeneratingVoice
                          ? 'generating_voice'
                          : 'idle'
                    }
                    interviewerAudioBusy={
                      interviewTTS.isSpeaking ||
                      interviewTTS.isSynthesisActive()
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {phase === 'answer_feedback' &&
          turnCoaching &&
          !prep.getCoachingForTurn(prep.feedbackTurnId) ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 sm:pb-6">
              <div className="pointer-events-auto w-full max-w-lg">
                <InterviewCoachTip
                  coaching={turnCoaching}
                  personaName={interviewerFirstName}
                  defaultOpen={false}
                />
              </div>
            </div>
          ) : null}

          {showExitModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0C0F0F] p-6 shadow-2xl">
                <h3 className="text-lg font-semibold text-white">
                  Leave the interview?
                </h3>
                <p className="mt-2 text-sm text-white/60">
                  Your progress will be lost and this session cannot be resumed.
                  Are you sure you want to leave?
                </p>

                <div className="mt-6 flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setShowExitModal(false)}
                  >
                    Continue interview
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    onClick={() => {
                      setShowExitModal(false);
                      leaveInterview();
                    }}
                  >
                    Yes, leave
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!mobileResponseOpen && (phase === 'answering' || inIntroSelf) ? (
            <button
              type="button"
              className="ip-fab-answer sm:hidden"
              onClick={() => setMobileResponseOpen(true)}
            >
              Answer
            </button>
          ) : null}
        </InterviewRoomAtmosphereLayer>
      </div>
    </InterviewVoiceProvider>
  );
}
