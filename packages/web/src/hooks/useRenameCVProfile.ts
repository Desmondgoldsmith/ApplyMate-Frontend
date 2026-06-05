'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useRenameCVProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.cv.updateProfileName(id, name),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(vars.id) });
    },
  });
}
