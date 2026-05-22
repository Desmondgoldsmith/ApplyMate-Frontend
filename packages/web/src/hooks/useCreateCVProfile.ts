'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useCreateCVProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; template?: string }) => api.cv.createProfile(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cv-profiles'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['cv-profile'] });
    },
  });
}
