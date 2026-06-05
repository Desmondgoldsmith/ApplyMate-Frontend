'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useUpdateCVSection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: object }) =>
      api.cv.updateSection(sectionId, data),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.sectionsRoot() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
    },
  });
}
