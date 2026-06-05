'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export function useHubBookmarks() {
  return useQuery({
    queryKey: queryKeys.hub.bookmarks(),
    queryFn: async () => {
      try {
        return await api.jobDiscovery.listBookmarks();
      } catch {
        /** Older stacks without GET /job-discovery/bookmarks — hub still works from apps + history. */
        return [];
      }
    },
    staleTime: 1000 * 30,
  });
}
