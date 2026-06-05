'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { api } from '@/lib/api';
import { cvParseMutationShouldRetry } from '@/lib/axios';
import { refreshCvStateAfterCvParseSuccess } from '@/lib/cvParseCacheReconcile';

export function useUploadCV(cvProfileId?: string | null) {
  const queryClient = useQueryClient();
  const cvProfileIdRef = useRef(cvProfileId);
  cvProfileIdRef.current = cvProfileId;

  return useMutation({
    mutationFn: (formData: FormData) =>
      api.cv.parse(formData, {
        rebuildSections: true,
        cvProfileId: cvProfileIdRef.current?.trim() || undefined,
      }),
    retry: cvParseMutationShouldRetry,
    onSuccess: async (result) => {
      await refreshCvStateAfterCvParseSuccess(queryClient, result.profile);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
    },
  });
}
