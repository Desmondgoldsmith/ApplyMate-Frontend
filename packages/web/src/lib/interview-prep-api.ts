import { axiosClient, throwIfApiFailureResponse } from '@/lib/axios';
import { dedupeTurnSubmit } from '@/lib/interviewRequestDedupe';
import type { InterviewSession } from '@/lib/api';
import type { PreCoachingResponse } from '@/lib/interview-coaching-types';
import type {
  AdaptiveProfile,
  AnswerSource,
  CoachingSettings,
  EnrichedPrepSession,
  InterviewImprovementPlan,
  InterviewProgressSnapshot,
  PracticeCoachingResponse,
  PrepTurnsResponse,
  SimulateSessionBody,
  SimulationState,
  SkillProfileResponse,
  TurnAnswerResponse,
} from '@/lib/interview-prep-types';

function unwrapPrepData<T>(raw: unknown): T {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.success === false) throw new Error(String(o.error ?? 'Request failed'));
    if ('data' in o && o.data !== undefined) return o.data as T;
  }
  return raw as T;
}

export const interviewPrepApi = {
  getProgress: async (): Promise<InterviewProgressSnapshot> => {
    const res = await axiosClient.get<unknown>('/interview-prep/progress');
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<InterviewProgressSnapshot>(res.data);
  },

  getAdaptiveProfile: async (): Promise<AdaptiveProfile> => {
    const res = await axiosClient.get<unknown>('/interview-prep/adaptive-profile');
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<AdaptiveProfile>(res.data);
  },

  getSkillProfile: async (): Promise<SkillProfileResponse> => {
    const res = await axiosClient.get<unknown>('/interview-prep/skill-profile');
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<SkillProfileResponse>(res.data);
  },

  getEnrichedSession: async (sessionId: string): Promise<EnrichedPrepSession> => {
    const res = await axiosClient.get<unknown>(`/interview-prep/sessions/${sessionId}`);
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<EnrichedPrepSession>(res.data);
  },

  getTurns: async (sessionId: string): Promise<PrepTurnsResponse> => {
    const res = await axiosClient.get<unknown>(`/interview-prep/sessions/${sessionId}/turns`);
    throwIfApiFailureResponse(res.data, res.status);
    const raw = unwrapPrepData<unknown>(res.data);
    if (Array.isArray(raw)) {
      return { turns: raw as PrepTurnsResponse['turns'], questionProgress: null };
    }
    if (raw !== null && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      const turns = Array.isArray(o.turns) ? (o.turns as PrepTurnsResponse['turns']) : [];
      const questionProgress =
        o.questionProgress !== null && typeof o.questionProgress === 'object'
          ? (o.questionProgress as PrepTurnsResponse['questionProgress'])
          : null;
      return { turns, questionProgress };
    }
    return { turns: [], questionProgress: null };
  },

  getTurnPreCoaching: async (
    sessionId: string,
    turnId: string,
  ): Promise<PreCoachingResponse> => {
    const res = await axiosClient.get<unknown>(
      `/interview-prep/sessions/${sessionId}/turns/${turnId}/coaching/pre`,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<PreCoachingResponse>(res.data);
  },

  submitPracticeCoaching: async (
    sessionId: string,
    body: {
      questionText: string;
      answerText: string;
      parentQuestionText?: string;
    },
  ): Promise<PracticeCoachingResponse> => {
    const res = await axiosClient.post<unknown>(
      `/interview-prep/sessions/${sessionId}/practice-coaching`,
      body,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<PracticeCoachingResponse>(res.data);
  },

  submitTurnAnswer: async (
    sessionId: string,
    turnId: string,
    body: {
      answerText: string;
      durationSeconds?: number;
      requestFollowUp?: boolean;
      requestCoaching?: boolean;
      answerSource?: AnswerSource;
      submittedAt?: string;
      /** Must match the question shown when answering (turn mismatch guard). */
      questionText?: string;
    },
  ): Promise<TurnAnswerResponse> => {
    return dedupeTurnSubmit(sessionId, turnId, body.answerText, async (signal) => {
      const res = await axiosClient.post<unknown>(
        `/interview-prep/sessions/${sessionId}/turns/${turnId}/answer`,
        body,
        { signal },
      );
      throwIfApiFailureResponse(res.data, res.status);
      return unwrapPrepData<TurnAnswerResponse>(res.data);
    });
  },

  getPlan: async (sessionId: string): Promise<InterviewImprovementPlan> => {
    const res = await axiosClient.get<unknown>(`/interview-prep/sessions/${sessionId}/plan`);
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<InterviewImprovementPlan>(res.data);
  },

  simulateSession: async (body: SimulateSessionBody): Promise<InterviewSession> => {
    const res = await axiosClient.post<unknown>('/interview-prep/simulate-session', body);
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<InterviewSession>(res.data);
  },

  patchCoachingSettings: async (
    sessionId: string,
    body: Partial<CoachingSettings>,
  ): Promise<{ coachingSettings: CoachingSettings }> => {
    const res = await axiosClient.patch<unknown>(
      `/interview-prep/sessions/${sessionId}/coaching-settings`,
      body,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<{ coachingSettings: CoachingSettings }>(res.data);
  },

  getSimulationState: async (sessionId: string): Promise<SimulationState> => {
    const res = await axiosClient.get<unknown>(`/interview-prep/simulation-state/${sessionId}`);
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapPrepData<SimulationState>(res.data);
  },
};
