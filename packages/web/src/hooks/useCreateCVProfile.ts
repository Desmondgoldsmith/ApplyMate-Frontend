'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { trackConversionFunnelEvent } from '@/lib/analytics';
import { api } from '@/lib/api';

export function useCreateCVProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; template?: string }) => api.cv.createProfile(data),
    onSuccess: (profile) => {
      trackConversionFunnelEvent('cv_created', {
        cvProfileId: profile.id,
        template: profile.template ?? undefined,
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() });
    },
  });
}
