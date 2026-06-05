'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useDeleteCVProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cv.deleteCvProfileById(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(id) });
    },
  });
}
