'use client';

import { useMutation } from '@tanstack/react-query';

import { api } from '@/lib/api';

/** Marks dashboard baseline as seen for stable "since last visit" deltas. */
export function useDashboardSeen() {
  return useMutation({
    mutationFn: () => api.dashboard.markSeen(),
  });
}

