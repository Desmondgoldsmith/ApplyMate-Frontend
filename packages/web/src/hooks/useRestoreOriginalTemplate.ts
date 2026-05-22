'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useRestoreOriginalTemplate(profileId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!profileId?.trim()) throw new Error('No profile ID');
      return api.cv.restoreOriginalTemplate(profileId.trim());
    },
    onSuccess: () => {
      const id = profileId?.trim() ?? '';
      void queryClient.invalidateQueries({ queryKey: ['cv-profile', id] });
      void queryClient.invalidateQueries({ queryKey: ['cv-profiles'] });
      void queryClient.invalidateQueries({ queryKey: ['cv-profile'] });
    },
  });
}
