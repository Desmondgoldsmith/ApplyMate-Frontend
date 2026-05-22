'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { interviewPrepApi } from '@/lib/interview-prep-api';
import {
  getCachedSimulation,
  setCachedSimulation,
  setCachedTurnResponse,
} from '@/lib/interviewSessionCache';
import type { AnswerSource, PrepTurnsResponse, SimulateSessionBody } from '@/lib/interview-prep-types';

export const INTERVIEW_PREP_PROGRESS_KEY = ['interview-prep', 'progress'] as const;
export const INTERVIEW_ADAPTIVE_PROFILE_KEY = ['interview-prep', 'adaptive-profile'] as const;
export const INTERVIEW_SKILL_PROFILE_KEY = ['interview-prep', 'skill-profile'] as const;

export function useInterviewPrepProgress(enabled = true) {
  return useQuery({
    queryKey: INTERVIEW_PREP_PROGRESS_KEY,
    queryFn: () => interviewPrepApi.getProgress(),
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

export function useAdaptiveProfile(enabled = true) {
  return useQuery({
    queryKey: INTERVIEW_ADAPTIVE_PROFILE_KEY,
    queryFn: () => interviewPrepApi.getAdaptiveProfile(),
    enabled,
    staleTime: 1000 * 60 * 3,
  });
}

export function useSkillProfile(enabled = true) {
  return useQuery({
    queryKey: INTERVIEW_SKILL_PROFILE_KEY,
    queryFn: () => interviewPrepApi.getSkillProfile(),
    enabled,
    staleTime: 1000 * 60 * 2,
  });
}

export function useEnrichedPrepSession(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['interview-prep', 'session', sessionId],
    queryFn: () => interviewPrepApi.getEnrichedSession(sessionId!),
    enabled: Boolean(sessionId) && enabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    placeholderData: (previousData) => previousData,
  });
}

export function useInterviewTurns(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['interview-prep', 'turns', sessionId],
    queryFn: () => interviewPrepApi.getTurns(sessionId!),
    enabled: Boolean(sessionId) && enabled,
    staleTime: 1000 * 15,
    select: (data: PrepTurnsResponse) => data,
  });
}

export function useSubmitPracticeCoaching(sessionId: string) {
  return useMutation({
    mutationFn: (body: {
      questionText: string;
      answerText: string;
      parentQuestionText?: string;
    }) => interviewPrepApi.submitPracticeCoaching(sessionId, body),
  });
}

export function useInterviewImprovementPlan(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['interview-prep', 'plan', sessionId],
    queryFn: () => interviewPrepApi.getPlan(sessionId!),
    enabled: Boolean(sessionId) && enabled,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSimulationState(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['interview-prep', 'simulation-state', sessionId],
    queryFn: async () => {
      const data = await interviewPrepApi.getSimulationState(sessionId!);
      setCachedSimulation(sessionId!, data);
      return data;
    },
    enabled: Boolean(sessionId) && enabled,
    staleTime: 1000 * 15,
    gcTime: 1000 * 60 * 5,
    refetchInterval: enabled ? 10000 : false,
    placeholderData: () =>
      sessionId ? getCachedSimulation(sessionId) : undefined,
  });
}

export function useSubmitInterviewTurnAnswer(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      turnId,
      ...body
    }: {
      turnId: string;
      answerText: string;
      durationSeconds?: number;
      requestFollowUp?: boolean;
      requestCoaching?: boolean;
      answerSource?: AnswerSource;
      submittedAt?: string;
      questionText?: string;
    }) => interviewPrepApi.submitTurnAnswer(sessionId, turnId, body),
    onSuccess: (data) => {
      setCachedTurnResponse(sessionId, data);
    },
  });
}

export function useCreateSimulateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SimulateSessionBody) => interviewPrepApi.simulateSession(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['interview-sessions'] });
      void queryClient.invalidateQueries({ queryKey: INTERVIEW_PREP_PROGRESS_KEY });
    },
  });
}
