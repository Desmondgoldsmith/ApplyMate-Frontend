'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useDeleteCVProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.cv.deleteCvProfileById(id),
    onSuccess: (_data, id) => {
      void queryClient.invalidateQueries({ queryKey: ['cv-profiles'] });
      void queryClient.invalidateQueries({ queryKey: ['analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['cv-profile'] });
      void queryClient.invalidateQueries({ queryKey: ['cv-profile', id] });
    },
  });
}
