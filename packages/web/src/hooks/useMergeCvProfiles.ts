'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { CvMergeCreatedResult, CvMergePreviewResult } from '@/lib/cvProfileMerge';
import { queryKeys } from '@/lib/queryKeys';

export function useMergeCvProfilesPreview() {
  return useMutation({
    mutationFn: (payload: {
      profileIds: string[];
      instructions?: string;
    }): Promise<CvMergePreviewResult> =>
      api.cv.mergeProfiles({ ...payload, mode: 'preview' }) as Promise<CvMergePreviewResult>,
  });
}

export function useMergeCvProfilesCreate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      profileIds: string[];
      name: string;
      structured: Record<string, unknown>;
      instructions?: string;
      template?: string;
    }): Promise<CvMergeCreatedResult> =>
      api.cv.mergeProfiles({ ...payload, mode: 'create' }) as Promise<CvMergeCreatedResult>,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
      const id = result.profileId.trim();
      if (id) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(id) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.cv.sections(id) });
      }
    },
  });
}
