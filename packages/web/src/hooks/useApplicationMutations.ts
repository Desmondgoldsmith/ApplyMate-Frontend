'use client';

import { queryKeys } from '@/lib/queryKeys';
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
    mutationFn: ({
      id,
      status,
      expectedStatus,
    }: {
      id: string;
      status: ApplicationTrackerStatus | string;
      expectedStatus?: string | null;
    }) => api.applications.updateStatus(id, status, { expectedStatus }),
    onSuccess: (app, { id }) => {
      queryClient.setQueryData(queryKeys.applications.detail(id), app);
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
      invalidateNotificationList(queryClient);
      scheduleUnreadNotificationCountInvalidate(queryClient);
      invalidateTodayPlanQueries(queryClient);
    },
  });
}
