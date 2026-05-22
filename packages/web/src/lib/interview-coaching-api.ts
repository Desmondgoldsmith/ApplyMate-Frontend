import { axiosClient, throwIfApiFailureResponse } from '@/lib/axios';
import { interviewPrepApi } from '@/lib/interview-prep-api';
import type {
  LiveCoachingRequest,
  LiveCoachingResponse,
  PostCoachingRequest,
  PostCoachingResponse,
  PreCoachingResponse,
} from '@/lib/interview-coaching-types';

function unwrapCoachingData<T>(raw: unknown): T {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.success === false) throw new Error(String(o.error ?? 'Request failed'));
    if ('data' in o && o.data !== undefined) return o.data as T;
  }
  return raw as T;
}

export const interviewCoachingApi = {
  getPreCoaching: async (sessionId: string, turnId: string): Promise<PreCoachingResponse> => {
    try {
      return await interviewPrepApi.getTurnPreCoaching(sessionId, turnId);
    } catch {
      const res = await axiosClient.get<unknown>(
        `/interview-coaching/pre/${sessionId}/${turnId}`,
      );
      throwIfApiFailureResponse(res.data, res.status);
      return unwrapCoachingData<PreCoachingResponse>(res.data);
    }
  },

  postLiveCoaching: async (
    sessionId: string,
    turnId: string,
    body: LiveCoachingRequest,
  ): Promise<LiveCoachingResponse> => {
    const res = await axiosClient.post<unknown>(
      `/interview-coaching/live/${sessionId}/${turnId}`,
      body,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapCoachingData<LiveCoachingResponse>(res.data);
  },

  postPostCoaching: async (
    sessionId: string,
    turnId: string,
    body: PostCoachingRequest,
  ): Promise<PostCoachingResponse> => {
    const res = await axiosClient.post<unknown>(
      `/interview-coaching/post/${sessionId}/${turnId}`,
      body,
    );
    throwIfApiFailureResponse(res.data, res.status);
    return unwrapCoachingData<PostCoachingResponse>(res.data);
  },
};
