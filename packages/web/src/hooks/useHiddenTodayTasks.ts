'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import {
  doneUntil,
  hiddenTaskIds,
  notTodayUntil,
} from '@/components/dashboard/home/homeModel';
import { useToast } from '@/components/ui/Toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { AuthUser } from '@/lib/api';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/store/useAuthStore';

export type HideKind = 'done' | 'not_today';

/** Home Today tasks the user marked Done or Not today; hiding is instant and saved to their account. */
export function useHiddenTodayTasks() {
  const { data: me } = useCurrentUser();
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pending, setPending] = useState<Record<string, string>>({});

  const stored = me?.uiPrefs?.dashboardHiddenTasks;
  const hidden = useMemo(
    () => hiddenTaskIds({ ...(stored ?? {}), ...pending }, new Date()),
    [stored, pending],
  );

  const hide = useCallback(
    async (taskId: string, kind: HideKind) => {
      const now = new Date();
      const until = (
        kind === 'done' ? doneUntil(now) : notTodayUntil(now)
      ).toISOString();
      setPending((p) => ({ ...p, [taskId]: until }));
      try {
        const saved = await api.dashboard.hideTodayTask(taskId, until);
        queryClient.setQueryData<AuthUser>(
          queryKeys.auth.me(accessToken ?? ''),
          (old) =>
            old
              ? {
                  ...old,
                  uiPrefs: {
                    ...(old.uiPrefs ?? {}),
                    dashboardHiddenTasks: saved,
                  },
                }
              : old,
        );
      } catch (e) {
        setPending((p) => {
          const next = { ...p };
          delete next[taskId];
          return next;
        });
        toast.error(getApiErrorMessage(e));
      }
    },
    [accessToken, queryClient, toast],
  );

  return { hidden, hide };
}
