'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

export function useCurrentUser() {
  const syncUserFromMe = useAuthStore((s) => s.syncUserFromMe);
  const accessToken = useAuthStore((s) => s.accessToken);

  const query = useQuery({
    /** Scope cache per session so a new login never reads another user's /me payload. */
    queryKey: ['me', accessToken ?? ''],
    queryFn: api.users.me,
    staleTime: 60_000,
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (query.data) {
      syncUserFromMe(query.data);
    }
  }, [query.data, syncUserFromMe]);

  return query;
}
