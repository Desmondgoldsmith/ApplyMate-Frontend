'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useSetDefaultCVProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cv.setDefaultCvProfile(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
    },
  });
}
