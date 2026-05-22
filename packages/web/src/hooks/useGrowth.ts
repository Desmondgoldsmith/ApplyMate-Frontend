'use client';

import { useMutation, useQuery, type QueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/ui/Toast';
import { api, type GrowthEventName, type GrowthProgressWindow } from '@/lib/api';

/** Invalidate dashboard growth widgets (`GET /growth/*`) after pipeline / application changes. */
export function invalidateGrowthQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ['growth'] });
}

const FEEDBACK_SESSION_KEY = 'applymate:growth:last-feedback-id';

export function useGrowthDailyDirection() {
  return useQuery({
    queryKey: ['growth', 'daily-direction'],
    queryFn: () => api.growth.getDailyDirection(),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}

export function useGrowthProgress(window: GrowthProgressWindow) {
  return useQuery({
    queryKey: ['growth', 'progress', window],
    queryFn: () => api.growth.getProgress(window),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}

export function useGrowthMomentumNudges() {
  return useQuery({
    queryKey: ['growth', 'momentum-nudges'],
    queryFn: () => api.growth.getMomentumNudges(),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}

export function useGrowthAchievements() {
  return useQuery({
    queryKey: ['growth', 'achievements'],
    queryFn: () => api.growth.getAchievements(),
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
}

export function useTrackGrowthEvent() {
  return useMutation({
    mutationFn: (payload: { eventName: GrowthEventName; context?: Record<string, unknown> }) =>
      api.growth.trackEvent(payload),
  });
}

export function useConsumeImmediateGrowthFeedback() {
  const toast = useToast();
  return async () => {
    try {
      const { feedback } = await api.growth.getImmediateFeedback();
      if (!feedback?.id || !feedback.message.trim()) return;
      const prev = typeof window !== 'undefined' ? window.sessionStorage.getItem(FEEDBACK_SESSION_KEY) : null;
      if (prev && prev === feedback.id) return;
      if (typeof window !== 'undefined') window.sessionStorage.setItem(FEEDBACK_SESSION_KEY, feedback.id);
      toast.success(feedback.message);
    } catch {
      // Keep completion flows resilient even if feedback endpoint is unavailable.
    }
  };
}
