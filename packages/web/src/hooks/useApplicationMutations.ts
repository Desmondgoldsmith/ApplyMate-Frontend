'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ApplicationTrackerStatus } from '@/lib/api';
import { api } from '@/lib/api';
import { invalidateGrowthQueries } from '@/hooks/useGrowth';
import {
  invalidateNotificationList,
  scheduleUnreadNotificationCountInvalidate,
} from '@/hooks/useNotifications';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationTrackerStatus | string }) =>
      api.applications.updateStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      void queryClient.invalidateQueries({ queryKey: ['job-history'] });
      invalidateNotificationList(queryClient);
      scheduleUnreadNotificationCountInvalidate(queryClient);
      invalidateGrowthQueries(queryClient);
      invalidateTodayPlanQueries(queryClient);
    },
  });
}

export function useUpdateApplicationNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => api.applications.updateNotes(id, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
      invalidateNotificationList(queryClient);
      scheduleUnreadNotificationCountInvalidate(queryClient);
      invalidateTodayPlanQueries(queryClient);
    },
  });
}
