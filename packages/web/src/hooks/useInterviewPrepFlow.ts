'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSubmitInterviewTurnAnswer } from '@/hooks/useInterviewPrep';
import {
  getCachedAdaptive,
  getCachedCoaching,
  getCachedTurnResponse,
  setCachedAdaptive,
  setCachedTurnResponse,
} from '@/lib/interviewSessionCache';
import { debounceByKey } from '@/lib/interviewRequestDedupe';
import type { InterviewSession } from '@/lib/api';
import {
  appendEvolutionPoint,
  buildAdaptiveTransitionMessage,
  orderPendingTurns,
  resolveAdaptiveFromResponse,
  snapshotFromAdaptive,
  type SessionAdaptiveSnapshot,
  type SkillEvolutionPoint,
} from '@/lib/interviewAdaptive';
import {
  coachInsightCacheKey,
  coachInsightDimensionScores,
  resolveCoachInsightFromResponse,
} from '@/lib/interviewCoachInsight';
import {
  beginCoachingUiState,
  coachingSnapshotFromResponse,
  partialCoachingUiState,
  readyCoachingUiState,
  type TurnCoachingUiState,
} from '@/lib/interviewCoachingSnapshot';
import { assertCoachingResponseQuality } from '@/lib/interviewCoachingFeedback';
import { coachHintsFromPersonalization } from '@/lib/interviewPersonalization';
import {
  assertCoachingQuestionAlignment,
  canEndInterviewSession,
  mainQuestionsComplete,
  type PrepNavigationResult,
  resolveActiveTurnIdAfterSubmit,
  resolveNextPlannedNavigation,
  resolveOptionalNextNavigation,
} from '@/lib/interviewPrepNavigation';
import type {
  AnswerSource,
  CoachInsight,
  DifficultyHint,
  InterviewTurn,
  NextQuestionPayload,
  PersonalizationPayload,
  PracticeCoachingResponse,
  QuestionProgress,
  SuggestedFollowUp,
  TurnAnswerResponse,
  TurnCoachingStatus,
} from '@/lib/interview-prep-types';
import {
  buildPendingTurnQueue,
  resolveTurnQuestionText,
  sessionHasPrepTurns,
} from '@/lib/interviewTurnQueue';

const EMPTY_ADAPTIVE: SessionAdaptiveSnapshot = {
  profile: null,
  session: null,
  recommendedNextTurnId: null,
  transitionMessage: null,
};

export type UseInterviewPrepFlowOptions = {
  coachingEnabled?: boolean;
  requestCoachingOnSubmit?: boolean;
};

export function useInterviewPrepFlow(
  session: InterviewSession | undefined,
  options: UseInterviewPrepFlowOptions = {},
) {
  const coachingEnabled = options.coachingEnabled !== false;
  const requestCoachingOnSubmit = options.requestCoachingOnSubmit !== false;
  const sessionId = session?.id ?? '';
  const queryClient = useQueryClient();
  const submitTurn = useSubmitInterviewTurnAnswer(sessionId);

  const usePrep = sessionHasPrepTurns(session);
  const [turnQueue, setTurnQueue] = useState<InterviewTurn[]>([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<TurnAnswerResponse | null>(null);
  const [followUpReason, setFollowUpReason] = useState<TurnAnswerResponse['followUp']>(null);

  /** Per-turn coaching cache — keyed by turnId (Phase 2). */
  const [coachingByTurnId, setCoachingByTurnId] = useState<Record<string, CoachInsight>>({});
  const [coachingStatusByTurnId, setCoachingStatusByTurnId] = useState<
    Record<string, TurnCoachingStatus>
  >({});
  const coachingKeyByTurnRef = useRef<Record<string, string>>({});

  /** Per-session adaptive state (Phase 3) — keyed by sessionId. */
  const [adaptiveBySessionId, setAdaptiveBySessionId] = useState<
    Record<string, SessionAdaptiveSnapshot>
  >({});
  const [evolutionBySessionId, setEvolutionBySessionId] = useState<
    Record<string, SkillEvolutionPoint[]>
  >({});
  const [difficultyPulseBySessionId, setDifficultyPulseBySessionId] = useState<
    Record<string, boolean>
  >({});
  const pendingRecommendedTurnRef = useRef<string | null>(null);
  const pendingNextQuestionRef = useRef<NextQuestionPayload | null>(null);
  const pendingNextPlannedQuestionRef = useRef<NextQuestionPayload | null>(null);
  const selectedFollowUpQuestionRef = useRef<string | null>(null);
  const partialCoachingTimerRef = useRef<number | null>(null);
  const lastDifficultyRef = useRef<'easy' | 'medium' | 'hard' | null>(null);
  const coachHintsTimerRef = useRef<number | null>(null);

  /** Phase D/E — personalization from turn submit. */
  const [lastPersonalization, setLastPersonalization] = useState<PersonalizationPayload | null>(
    null,
  );
  const [pendingQuestionStyle, setPendingQuestionStyle] = useState<DifficultyHint | null>(null);
  const [coachHints, setCoachHints] = useState<string[]>([]);
  const [questionStyleFading, setQuestionStyleFading] = useState(false);

  /** Phase 2B — instant coaching UI per turn. */
  const [coachingStateByTurnId, setCoachingStateByTurnId] = useState<
    Record<string, TurnCoachingUiState>
  >({});
  /** Turn being coached before `lastFeedback` is set (instant feedback phase). */
  const [activeCoachingTurnId, setActiveCoachingTurnId] = useState<string | null>(null);

  const [questionProgress, setQuestionProgress] = useState<QuestionProgress | null>(null);
  const [activePracticeChip, setActivePracticeChip] = useState<SuggestedFollowUp | null>(null);
  const [practiceFeedback, setPracticeFeedback] = useState<PracticeCoachingResponse | null>(
    null,
  );

  useEffect(() => {
    if (!sessionId) return;
    lastDifficultyRef.current = null;
    pendingRecommendedTurnRef.current = null;
    pendingNextQuestionRef.current = null;
    pendingNextPlannedQuestionRef.current = null;
    if (partialCoachingTimerRef.current) {
      window.clearTimeout(partialCoachingTimerRef.current);
      partialCoachingTimerRef.current = null;
    }
    if (coachHintsTimerRef.current) {
      window.clearTimeout(coachHintsTimerRef.current);
      coachHintsTimerRef.current = null;
    }
    setLastPersonalization(null);
    setPendingQuestionStyle(null);
    setCoachHints([]);
    setQuestionStyleFading(false);
    setQuestionProgress(null);
    setActivePracticeChip(null);
    setPracticeFeedback(null);
  }, [sessionId]);

  const adaptiveSnapshot = sessionId
    ? (adaptiveBySessionId[sessionId] ?? EMPTY_ADAPTIVE)
    : EMPTY_ADAPTIVE;
  const evolutionHistory = sessionId ? (evolutionBySessionId[sessionId] ?? []) : [];
  const difficultyPulse = sessionId ? Boolean(difficultyPulseBySessionId[sessionId]) : false;

  const syncQueueFromSession = useCallback(
    (recommendedNextTurnId?: string | null) => {
      if (!session?.turns?.length) {
        setTurnQueue([]);
        return;
      }
      const pending = buildPendingTurnQueue(session.turns);
      const ordered = orderPendingTurns(pending, recommendedNextTurnId ?? pendingRecommendedTurnRef.current);
      setTurnQueue(ordered);
      setTurnIndex((idx) => Math.min(idx, Math.max(0, ordered.length - 1)));
    },
    [session?.turns],
  );

  /** Do not rebuild the pending queue while feedback is showing — that swaps the on-screen question early. */
  useEffect(() => {
    if (lastFeedback) return;
    syncQueueFromSession();
  }, [lastFeedback, session?.id, syncQueueFromSession]);

  const currentTurn = usePrep ? turnQueue[turnIndex] : null;
  const isFollowUp = Boolean(currentTurn?.parentTurnId);

  const currentQuestionText = useMemo(() => {
    if (!currentTurn || !session) return '';
    return resolveTurnQuestionText(currentTurn, session.questions ?? []);
  }, [currentTurn, session]);

  const totalTurns = session?.totalQuestions ?? turnQueue.length;
  const answeredCount = useMemo(() => {
    if (!session?.turns) return 0;
    return session.turns.filter((t) => t.status === 'answered' || t.status === 'evaluated').length;
  }, [session?.turns]);

  const feedbackTurnId =
    lastFeedback?.answeredQuestion?.turnId ??
    lastFeedback?.turn?.id ??
    activeCoachingTurnId;

  const scheduleSessionRefresh = useCallback(() => {
    if (!sessionId) return;
    debounceByKey(`prep-refresh:${sessionId}`, 500, () => {
      void queryClient.invalidateQueries({ queryKey: ['interview-session', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['interview-prep', 'turns', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['interview-prep', 'session', sessionId] });
      void queryClient.invalidateQueries({
        queryKey: ['interview-prep', 'simulation-state', sessionId],
      });
      void queryClient.invalidateQueries({ queryKey: ['interview-prep', 'skill-profile'] });
    });
  }, [queryClient, sessionId]);

  const beginCoachingSubmit = useCallback((turnId: string) => {
    setActiveCoachingTurnId(turnId);
    setCoachingStateByTurnId((prev) => ({
      ...prev,
      [turnId]: beginCoachingUiState(),
    }));
    setCoachingStatusByTurnId((prev) => ({ ...prev, [turnId]: 'loading' }));

    if (partialCoachingTimerRef.current) {
      window.clearTimeout(partialCoachingTimerRef.current);
    }
    partialCoachingTimerRef.current = window.setTimeout(() => {
      partialCoachingTimerRef.current = null;
      setCoachingStateByTurnId((prev) => {
        const cur = prev[turnId];
        if (!cur?.loading || cur.data) return prev;
        return { ...prev, [turnId]: partialCoachingUiState() };
      });
    }, 320);
  }, []);

  const cacheCoachingForTurn = useCallback((turnId: string, response: TurnAnswerResponse) => {
    const insight = resolveCoachInsightFromResponse(response);
    if (insight) {
      const key = coachInsightCacheKey(insight);
      if (coachingKeyByTurnRef.current[turnId] !== key) {
        coachingKeyByTurnRef.current[turnId] = key;
        setCoachingByTurnId((prev) => ({ ...prev, [turnId]: insight }));
      }
    }
    setCoachingStatusByTurnId((prev) => ({ ...prev, [turnId]: 'ready' }));
  }, []);

  const hydrateCoachingFromResponse = useCallback(
    (turnId: string, response: TurnAnswerResponse) => {
      if (partialCoachingTimerRef.current) {
        window.clearTimeout(partialCoachingTimerRef.current);
        partialCoachingTimerRef.current = null;
      }

      const snapshot = coachingSnapshotFromResponse(response);
      if (snapshot) {
        setCoachingStateByTurnId((prev) => ({
          ...prev,
          [turnId]: readyCoachingUiState(snapshot),
        }));
      } else {
        setCoachingStateByTurnId((prev) => ({
          ...prev,
          [turnId]: { loading: false, partial: false, data: null },
        }));
      }

      cacheCoachingForTurn(turnId, response);
    },
    [cacheCoachingForTurn],
  );

  const getCoachingStateForTurn = useCallback(
    (turnId: string | null): TurnCoachingUiState | null => {
      if (!turnId) return null;
      return coachingStateByTurnId[turnId] ?? null;
    },
    [coachingStateByTurnId],
  );

  const clearCoachingStateForTurn = useCallback((turnId: string) => {
    setActiveCoachingTurnId((cur) => (cur === turnId ? null : cur));
    setCoachingStateByTurnId((prev) => {
      const next = { ...prev };
      delete next[turnId];
      return next;
    });
  }, []);

  const setCoachingLoading = useCallback(
    (turnId: string) => {
      beginCoachingSubmit(turnId);
    },
    [beginCoachingSubmit],
  );

  const applyPersonalizationFromResponse = useCallback((response: TurnAnswerResponse) => {
    const p = response.personalization;
    if (!p) return;
    setLastPersonalization(p);
    if (p.difficultyHint) {
      setPendingQuestionStyle((prev) => {
        const next = p.difficultyHint!;
        const changed =
          prev?.difficultyLevel !== next.difficultyLevel ||
          prev?.questionStyle !== next.questionStyle;
        if (changed) {
          setQuestionStyleFading(true);
          window.setTimeout(() => setQuestionStyleFading(false), 480);
        }
        return next;
      });
    }
    const hints = coachHintsFromPersonalization(p);
    if (!hints.length) return;
    setCoachHints(hints);
    if (coachHintsTimerRef.current) window.clearTimeout(coachHintsTimerRef.current);
    coachHintsTimerRef.current = window.setTimeout(() => {
      setCoachHints([]);
      coachHintsTimerRef.current = null;
    }, 6500);
  }, []);

  const applyAdaptiveFromResponse = useCallback(
    (sid: string, response: TurnAnswerResponse) => {
      const adaptive = resolveAdaptiveFromResponse(response);
      if (!adaptive) return;

      const transitionMessage = buildAdaptiveTransitionMessage(
        adaptive,
        lastDifficultyRef.current,
      );
      const nextDifficulty = adaptive.session.recommendedDifficulty;
      const difficultyChanged =
        lastDifficultyRef.current !== null &&
        lastDifficultyRef.current !== nextDifficulty;
      lastDifficultyRef.current = nextDifficulty;

      pendingRecommendedTurnRef.current =
        adaptive.session.recommendedNextTurnId ?? null;

      const snapshot = snapshotFromAdaptive(adaptive, transitionMessage);
      setAdaptiveBySessionId((prev) => ({
        ...prev,
        [sid]: snapshot,
      }));
      setCachedAdaptive(sid, snapshot);

      if (difficultyChanged) {
        setDifficultyPulseBySessionId((prev) => ({ ...prev, [sid]: true }));
        window.setTimeout(() => {
          setDifficultyPulseBySessionId((p) => ({ ...p, [sid]: false }));
        }, 1200);
      }

      const insight = resolveCoachInsightFromResponse(response);
      const scores = coachInsightDimensionScores(insight, response.scores);
      setEvolutionBySessionId((prev) => {
        const history = prev[sid] ?? [];
        return {
          ...prev,
          [sid]: appendEvolutionPoint(history, response.turn.id, scores, adaptive.profile),
        };
      });

      if (process.env.NODE_ENV !== 'production' && adaptive.reasoningTags?.length) {
        console.debug('[interview-adaptive]', adaptive.reasoningTags);
      }
    },
    [],
  );

  const getCoachingForTurn = useCallback(
    (turnId: string | null): CoachInsight | null => {
      if (!turnId) return null;
      return coachingByTurnId[turnId] ?? null;
    },
    [coachingByTurnId],
  );

  const getCoachingStatusForTurn = useCallback(
    (turnId: string | null): TurnCoachingStatus => {
      if (!turnId) return 'idle';
      return coachingStatusByTurnId[turnId] ?? 'idle';
    },
    [coachingStatusByTurnId],
  );

  const navigateToPrepTurn = useCallback(
    (payload: NextQuestionPayload | null | undefined): PrepNavigationResult | null => {
      if (!payload?.questionText?.trim()) return null;
      const text = payload.questionText.trim();
      if (payload.turnId && session?.turns?.length) {
        const pending = buildPendingTurnQueue(session.turns);
        const ordered = orderPendingTurns(pending, payload.turnId);
        const idx = ordered.findIndex((t) => t.id === payload.turnId);
        setTurnQueue(ordered);
        setTurnIndex(idx >= 0 ? idx : 0);
        return {
          done: idx >= ordered.length - 1,
          questionText: text,
          turnId: payload.turnId,
        };
      }
      return { done: false, questionText: text, turnId: payload.turnId };
    },
    [session?.turns],
  );

  const clearFeedbackPhase = useCallback(() => {
    const feedbackId = lastFeedback?.turn?.id;
    if (feedbackId) clearCoachingStateForTurn(feedbackId);
    setLastFeedback(null);
    setFollowUpReason(null);
  }, [clearCoachingStateForTurn, lastFeedback?.turn?.id]);

  const startAnswerForNavigation = useCallback(
    (payload: NextQuestionPayload | null | undefined): PrepNavigationResult | null => {
      clearFeedbackPhase();
      return navigateToPrepTurn(payload);
    },
    [clearFeedbackPhase, navigateToPrepTurn],
  );

  const storeNavigationFromResponse = useCallback((res: TurnAnswerResponse) => {
    pendingNextPlannedQuestionRef.current = resolveNextPlannedNavigation(res);
    pendingRecommendedTurnRef.current = null;
    pendingNextQuestionRef.current = resolveOptionalNextNavigation(res);
  }, []);

  const submitPrepAnswer = useCallback(
    async (
      answerText: string,
      durationSeconds: number,
      answerSource?: AnswerSource,
      expectedTurnId?: string,
      questionText?: string,
    ) => {
      if (!currentTurn || !sessionId) return null;
      setActivePracticeChip(null);
      setPracticeFeedback(null);
      const turnId = currentTurn.id;
      const questionShown =
        questionText?.trim() ||
        resolveTurnQuestionText(currentTurn, session?.questions ?? []);
      if (!questionShown) return null;
      if (coachingEnabled) beginCoachingSubmit(turnId);
      const submittedAt = new Date().toISOString();
      let res: TurnAnswerResponse;
      try {
        res = await submitTurn.mutateAsync({
          turnId,
          answerText,
          durationSeconds,
          requestFollowUp: true,
          requestCoaching: coachingEnabled && requestCoachingOnSubmit,
          answerSource,
          submittedAt,
          questionText: questionShown,
        });
      } catch (err) {
        const cached = getCachedTurnResponse(sessionId, turnId);
        if (cached) {
          setLastFeedback(cached);
          hydrateCoachingFromResponse(turnId, cached);
          applyAdaptiveFromResponse(sessionId, cached);
          storeNavigationFromResponse(cached);
          assertCoachingQuestionAlignment(cached);
          assertCoachingResponseQuality(cached);
          return cached;
        }
        throw err;
      }
      setLastFeedback(res);
      setFollowUpReason(res.followUp);
      selectedFollowUpQuestionRef.current = null;
      storeNavigationFromResponse(res);
      if (res.questionProgress) setQuestionProgress(res.questionProgress);
      const resolvedTurnId = resolveActiveTurnIdAfterSubmit(res, turnId);
      setActiveCoachingTurnId(resolvedTurnId);
      syncQueueFromSession(resolvedTurnId);
      assertCoachingQuestionAlignment(res);
      assertCoachingResponseQuality(res);
      setCachedTurnResponse(sessionId, res);
      hydrateCoachingFromResponse(resolvedTurnId, res);
      applyAdaptiveFromResponse(sessionId, res);
      applyPersonalizationFromResponse(res);
      scheduleSessionRefresh();

      if (
        res.followUp?.turnId &&
        !res.canCompleteInterview &&
        !mainQuestionsComplete(res.questionProgress)
      ) {
        const newTurn: InterviewTurn = {
          id: res.followUp.turnId,
          questionId: currentTurn.questionId,
          parentTurnId: currentTurn.id,
          order: currentTurn.order + 1,
          depth: (currentTurn.depth ?? 0) + 1,
          category: currentTurn.category,
          questionText: res.followUp.question,
          status: 'pending',
        };
        setTurnQueue((prev) => {
          const next = [...prev];
          next.splice(turnIndex + 1, 0, newTurn);
          pendingRecommendedTurnRef.current = null;
          return next;
        });
      }

      return res;
    },
    [
      applyAdaptiveFromResponse,
      applyPersonalizationFromResponse,
      beginCoachingSubmit,
      currentTurn,
      hydrateCoachingFromResponse,
      session?.questions,
      sessionId,
      submitTurn,
      scheduleSessionRefresh,
      coachingEnabled,
      requestCoachingOnSubmit,
      storeNavigationFromResponse,
      syncQueueFromSession,
      turnIndex,
    ],
  );

  const beginPracticeChip = useCallback((chip: SuggestedFollowUp) => {
    setActivePracticeChip(chip);
    setPracticeFeedback(null);
  }, []);

  const clearPractice = useCallback(() => {
    setActivePracticeChip(null);
    setPracticeFeedback(null);
  }, []);

  const completePracticeAnswer = useCallback((res: PracticeCoachingResponse) => {
    setActivePracticeChip(null);
    setPracticeFeedback(res);
  }, []);

  const restoreFeedbackSnapshot = useCallback((snapshot: TurnAnswerResponse | null) => {
    if (snapshot) {
      setLastFeedback(snapshot);
      setFollowUpReason(snapshot.followUp ?? null);
    }
  }, []);

  const setSelectedFollowUpQuestion = useCallback((question: string | null) => {
    selectedFollowUpQuestionRef.current = question?.trim() || null;
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const cached = getCachedAdaptive(sessionId);
    if (cached && !adaptiveBySessionId[sessionId]) {
      setAdaptiveBySessionId((prev) => ({ ...prev, [sessionId]: cached }));
    }
  }, [adaptiveBySessionId, sessionId]);

  /** Move to queued follow-up turn after post/legacy feedback (skip full advance). */
  const tryAdvanceToQueuedFollowUp = useCallback(() => {
    const feedbackId = lastFeedback?.turn?.id;
    if (feedbackId) clearCoachingStateForTurn(feedbackId);
    setLastFeedback(null);
    setFollowUpReason(null);
    const next = turnQueue[turnIndex + 1];
    if (next?.parentTurnId) {
      setTurnIndex((i) => i + 1);
      return next;
    }
    return null;
  }, [clearCoachingStateForTurn, lastFeedback?.turn?.id, turnIndex, turnQueue]);

  const advanceAfterFeedback = useCallback(async () => {
    const recommendedId = pendingRecommendedTurnRef.current;
    const feedbackId = lastFeedback?.turn?.id;
    if (feedbackId) clearCoachingStateForTurn(feedbackId);
    setLastFeedback(null);
    setFollowUpReason(null);

    const planned = pendingNextPlannedQuestionRef.current;
    pendingNextPlannedQuestionRef.current = null;
    pendingNextQuestionRef.current = null;

    if (canEndInterviewSession(questionProgress)) {
      scheduleSessionRefresh();
      return { done: true as const };
    }

    if (planned && !recommendedId) {
      const nav = navigateToPrepTurn(planned);
      if (nav) {
        scheduleSessionRefresh();
        return nav;
      }
    }

    const hasMore = turnIndex + 1 < turnQueue.length;

    if (recommendedId && session?.turns?.length) {
      const pending = buildPendingTurnQueue(session.turns);
      const ordered = orderPendingTurns(pending, recommendedId);
      const idx = ordered.findIndex((t) => t.id === recommendedId);
      pendingRecommendedTurnRef.current = null;
      setTurnQueue(ordered);
      setTurnIndex(idx >= 0 ? idx : 0);
      scheduleSessionRefresh();
      return { done: idx >= ordered.length - 1 };
    }

    if (hasMore) {
      const next = turnQueue[turnIndex + 1];
      if (!next?.parentTurnId) {
        setTurnIndex((i) => i + 1);
        scheduleSessionRefresh();
        return { done: false as const };
      }
    }
    scheduleSessionRefresh();
    syncQueueFromSession();
    return { done: true as const };
  }, [
    clearCoachingStateForTurn,
    lastFeedback?.turn?.id,
    navigateToPrepTurn,
    scheduleSessionRefresh,
    session?.turns,
    sessionId,
    syncQueueFromSession,
    questionProgress,
    turnIndex,
    turnQueue.length,
  ]);

  const skipFollowUpAndContinue = useCallback(async () => {
    const feedbackId = lastFeedback?.turn?.id;
    if (feedbackId) clearCoachingStateForTurn(feedbackId);
    setLastFeedback(null);
    setFollowUpReason(null);

    const planned = pendingNextPlannedQuestionRef.current;
    pendingNextPlannedQuestionRef.current = null;
    pendingNextQuestionRef.current = null;

    const nav = navigateToPrepTurn(planned);
    if (nav) {
      scheduleSessionRefresh();
      return nav;
    }

    return advanceAfterFeedback();
  }, [
    advanceAfterFeedback,
    clearCoachingStateForTurn,
    lastFeedback?.turn?.id,
    navigateToPrepTurn,
    scheduleSessionRefresh,
  ]);

  const acceptFollowUpAndContinue = useCallback(async () => {
    const followUp =
      pendingNextQuestionRef.current ??
      resolveOptionalNextNavigation(lastFeedback);
    if (!followUp?.turnId || !followUp.questionText?.trim()) return null;
    pendingNextQuestionRef.current = null;
    pendingRecommendedTurnRef.current = followUp.turnId;
    const nav = startAnswerForNavigation(followUp);
    if (nav) {
      scheduleSessionRefresh();
      return nav;
    }
    return null;
  }, [lastFeedback, scheduleSessionRefresh, startAnswerForNavigation]);

  const prepProgressPercent = useMemo(() => {
    if (!usePrep || totalTurns <= 0) return 0;
    return Math.min(100, Math.round(((answeredCount + (lastFeedback ? 0 : 0)) / totalTurns) * 100));
  }, [answeredCount, lastFeedback, totalTurns, usePrep]);

  return {
    usePrep,
    currentTurn,
    currentQuestionText,
    isFollowUp,
    lastFeedback,
    followUpReason,
    feedbackTurnId,
    coachingByTurnId,
    getCoachingForTurn,
    getCoachingStatusForTurn,
    adaptiveSnapshot,
    evolutionHistory,
    difficultyPulse,
    lastPersonalization,
    pendingQuestionStyle,
    questionStyleFading,
    coachHints,
    questionProgress,
    setQuestionProgress,
    activePracticeChip,
    practiceFeedback,
    beginPracticeChip,
    clearPractice,
    completePracticeAnswer,
    restoreFeedbackSnapshot,
    setPracticeFeedback,
    coachingStateByTurnId,
    getCoachingStateForTurn,
    beginCoachingSubmit,
    submitPrepAnswer,
    tryAdvanceToQueuedFollowUp,
    skipFollowUpAndContinue,
    acceptFollowUpAndContinue,
    startAnswerForNavigation,
    navigateToPrepTurn,
    advanceAfterFeedback,
    setSelectedFollowUpQuestion,
    getSelectedFollowUpQuestion: () => selectedFollowUpQuestionRef.current,
    submitTurnPending: submitTurn.isPending,
    turnIndex,
    turnQueueLength: turnQueue.length,
    prepProgressPercent,
    answeredCount,
    syncQueueFromSession,
  };
}
