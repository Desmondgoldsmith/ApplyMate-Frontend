'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { JobHubGuidancePayload } from '@/lib/jobHubGuidance';
import { getApiErrorMessage } from '@/lib/axios';
import { queryKeys } from '@/lib/queryKeys';

import { useToast } from '@/components/ui/Toast';

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

type PatchArgs =
  | {
      scope: 'application';
      applicationId: string;
      taskId: string;
      userCompleted: boolean;
    }
  | {
      scope: 'hub';
      jobAnalysisId?: string | null;
      bookmarkId?: string | null;
      taskId: string;
      userCompleted: boolean;
    };

export function usePatchJobHubGuidance() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async (args: PatchArgs): Promise<JobHubGuidancePayload> => {
      const timezone = browserTimezone();
      if (args.scope === 'application') {
        return api.applications.patchGuidance(args.applicationId, {
          taskId: args.taskId,
          userCompleted: args.userCompleted,
          timezone,
        });
      }
      return api.jobs.patchHubGuidance({
        taskId: args.taskId,
        userCompleted: args.userCompleted,
        timezone,
        jobAnalysisId: args.jobAnalysisId ?? undefined,
        bookmarkId: args.bookmarkId ?? undefined,
      });
    },
    onSuccess: (guidance, args) => {
      if (args.scope === 'application') {
        queryClient.setQueryData(queryKeys.applications.detail(args.applicationId), (prev: unknown) => {
          if (prev === null || typeof prev !== 'object') return prev;
          return { ...(prev as Record<string, unknown>), guidance };
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.applications.detail(args.applicationId),
        });
      }
      if (args.scope === 'hub') {
        if (args.jobAnalysisId) {
          queryClient.setQueryData(queryKeys.jobs.analysis(args.jobAnalysisId), (prev: unknown) => {
            if (prev === null || typeof prev !== 'object') return prev;
            return { ...(prev as Record<string, unknown>), guidance };
          });
          void queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.analysis(args.jobAnalysisId),
          });
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.history() });
      }
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err) || 'Could not update checklist');
    },
  });
}
