'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

export function useOnboardingStatus() {
  const accessToken = useAuthStore((s) => s.accessToken);

  return useQuery({
    /** Scope per session — avoids showing another user's completed onboarding state. */
    queryKey: queryKeys.onboarding.status(accessToken ?? ''),
    queryFn: api.onboarding.getStatus,
    staleTime: 30_000,
    retry: 2,
    enabled: Boolean(accessToken),
  });
}

export function useSaveOnboardingProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.onboarding.saveProgress,
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.onboarding.statusRoot(),
      });
    },
  });
}
