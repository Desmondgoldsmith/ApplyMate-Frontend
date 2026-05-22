'use client';

import { useMemo } from 'react';

import { mapMeToDailyAiUsage } from '@/lib/ai-daily-usage';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/** Server-backed daily AI usage (FREE tier cap / PAID unlimited) from `GET /users/me`. */
export function useDailyAiUsage() {
  const { data: me, isPending } = useCurrentUser();
  return useMemo(() => mapMeToDailyAiUsage(me ?? null, isPending), [me, isPending]);
}
