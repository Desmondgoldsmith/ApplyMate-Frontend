'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useDuplicateCVProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cv.duplicateCvProfile(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cv-profiles'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}
