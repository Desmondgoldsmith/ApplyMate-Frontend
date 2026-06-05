'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type HubReminderItem, type HubReminderStatus } from '@/lib/api';
import { hubRemindersFilterKey } from '@/lib/hubNotesQueryKeys';
import { invalidateGrowthQueries } from '@/hooks/useGrowth';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';

function tempReminderId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function invalidateReminderSideEffects(
  queryClient: ReturnType<typeof useQueryClient>,
  jobAnalysisId?: string | null,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.hub.remindersRoot() });
  if (jobAnalysisId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analysis(jobAnalysisId) });
  }
  void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
  invalidateTodayPlanQueries(queryClient);
  invalidateGrowthQueries(queryClient);
}

export type HubReminderScope = {
  jobAnalysisId?: string | null;
  jobBookmarkId?: string | null;
};

export function useHubReminders(scope: HubReminderScope) {
  const queryClient = useQueryClient();
  const canUse = Boolean(scope.jobAnalysisId || scope.jobBookmarkId);
  const filter = {
    jobAnalysisId: scope.jobAnalysisId ?? undefined,
    jobBookmarkId: scope.jobBookmarkId ?? undefined,
  };
  const queryKey = hubRemindersFilterKey(filter);

  const query = useQuery({
    queryKey,
    queryFn: () =>
      api.jobs.listHubReminders(
        scope.jobAnalysisId
          ? { jobAnalysisId: scope.jobAnalysisId }
          : { jobBookmarkId: scope.jobBookmarkId! },
      ),
    enabled: canUse,
  });

  const pending = (query.data ?? []).filter((r) => r.status === 'pending');

  const createReminder = useMutation({
    mutationFn: (payload: { remindAt: string; title?: string; note?: string }) => {
      if (scope.jobAnalysisId) {
        return api.jobs.createHubReminder({
          jobAnalysisId: scope.jobAnalysisId,
          remindAt: payload.remindAt,
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.note ? { note: payload.note } : {}),
        });
      }
      if (scope.jobBookmarkId) {
        return api.jobs.createHubReminder({
          jobBookmarkId: scope.jobBookmarkId,
          remindAt: payload.remindAt,
          ...(payload.title ? { title: payload.title } : {}),
          ...(payload.note ? { note: payload.note } : {}),
        });
      }
      return Promise.reject(new Error('No reminder scope'));
    },
    onMutate: async (payload) => {
      if (!canUse) return {};
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HubReminderItem[]>(queryKey);
      const now = new Date().toISOString();
      const optimistic: HubReminderItem = {
        id: tempReminderId(),
        jobAnalysisId: scope.jobAnalysisId ?? null,
        jobBookmarkId: scope.jobBookmarkId ?? null,
        remindAt: payload.remindAt,
        title: payload.title ?? null,
        note: payload.note ?? null,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      };
      queryClient.setQueryData<HubReminderItem[]>(queryKey, (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { previous, tempId: optimistic.id };
    },
    onSuccess: (serverRow, _payload, ctx) => {
      if (!ctx?.tempId) return;
      queryClient.setQueryData<HubReminderItem[]>(queryKey, (old) =>
        (old ?? []).map((row) => (row.id === ctx.tempId ? serverRow : row)),
      );
    },
    onError: (_err, _payload, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: () => {
      invalidateReminderSideEffects(queryClient, scope.jobAnalysisId);
    },
  });

  const patchReminder = useMutation({
    mutationFn: (args: {
      id: string;
      status?: HubReminderStatus;
      remindAt?: string;
      title?: string;
      note?: string;
    }) =>
      api.jobs.patchHubReminder(args.id, {
        ...(args.status !== undefined ? { status: args.status } : {}),
        ...(args.remindAt !== undefined ? { remindAt: args.remindAt } : {}),
        ...(args.title !== undefined ? { title: args.title } : {}),
        ...(args.note !== undefined ? { note: args.note } : {}),
      }),
    onMutate: async (args) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HubReminderItem[]>(queryKey);
      queryClient.setQueryData<HubReminderItem[]>(queryKey, (old) =>
        (old ?? []).map((row) =>
          row.id === args.id
            ? {
                ...row,
                ...(args.status !== undefined ? { status: args.status } : {}),
                ...(args.remindAt !== undefined ? { remindAt: args.remindAt } : {}),
                ...(args.title !== undefined ? { title: args.title } : {}),
                ...(args.note !== undefined ? { note: args.note } : {}),
                updatedAt: new Date().toISOString(),
              }
            : row,
        ),
      );
      return { previous };
    },
    onError: (_err, _args, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: () => {
      invalidateReminderSideEffects(queryClient, scope.jobAnalysisId);
    },
  });

  const deleteReminder = useMutation({
    mutationFn: (id: string) => api.jobs.deleteHubReminder(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HubReminderItem[]>(queryKey);
      queryClient.setQueryData<HubReminderItem[]>(queryKey, (old) =>
        (old ?? []).filter((row) => row.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: () => {
      invalidateReminderSideEffects(queryClient, scope.jobAnalysisId);
    },
  });

  return {
    query,
    pending,
    createReminder,
    patchReminder,
    deleteReminder,
    canUse,
    isMutating:
      createReminder.isPending ||
      patchReminder.isPending ||
      deleteReminder.isPending,
  };
}

/** Prefetch all pending hub reminders for due notifications and hub-wide lists. */
export function useHubRemindersPrefetch() {
  return useQuery({
    queryKey: hubRemindersFilterKey({ status: 'pending' }),
    queryFn: () => api.jobs.listHubReminders({ status: 'pending' }),
    staleTime: 60_000,
  });
}
