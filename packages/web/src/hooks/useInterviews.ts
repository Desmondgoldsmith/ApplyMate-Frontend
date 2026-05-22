'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import {
  interviewResultFromPoll,
  type InterviewEvaluationPollState,
} from '@/lib/interviewEvaluationPoll';
import { getCachedSession, setCachedSession } from '@/lib/interviewSessionCache';

export function useInterviewSessions() {
  return useQuery({
    queryKey: ['interview-sessions'],
    queryFn: () => api.interviews.list(),
    staleTime: 1000 * 60 * 2,
  });
}

export function useInterviewSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['interview-session', sessionId],
    queryFn: async () => {
      const session = await api.interviews.get(sessionId!);
      setCachedSession(sessionId!, session);
      return session;
    },
    enabled: !!sessionId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    placeholderData: () =>
      sessionId ? getCachedSession(sessionId) : undefined,
  });
}

export function useInterviewResult(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['interview-result', sessionId],
    queryFn: () => api.interviews.getResult(sessionId!),
    enabled: !!sessionId && enabled,
    retry: false,
    refetchInterval: (query) => {
      const poll = query.state.data as InterviewEvaluationPollState | undefined;
      if (poll?.status === 'completed' || poll?.status === 'failed') return false;
      if (query.state.status === 'error') return false;
      return 4000;
    },
    staleTime: 0,
  });
}

/** Completed result extracted from poll state (null while queued/processing/failed). */
export function useInterviewResultData(
  sessionId: string | null,
  enabled: boolean,
) {
  const q = useInterviewResult(sessionId, enabled);
  return {
    ...q,
    result: interviewResultFromPoll(q.data),
    poll: q.data,
  };
}

export function useRetryInterviewEvaluation(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.interviews.retryEvaluation(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['interview-result', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['interview-session', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['interview-sessions'] });
    },
  });
}

export function useCreateInterview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.interviews.create,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['interview-sessions'],
      });
    },
  });
}

export type SubmitInterviewAnswersInput = {
  answers: Parameters<typeof api.interviews.submitAnswers>[1];
  idempotencyKey?: string;
};

export function useSubmitInterviewAnswers(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ answers, idempotencyKey }: SubmitInterviewAnswersInput) =>
      api.interviews.submitAnswers(sessionId, answers, { idempotencyKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['interview-session', sessionId],
      });
    },
  });
}
