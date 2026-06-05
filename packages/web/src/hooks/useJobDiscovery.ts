'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';

export type JobDiscoveryParams = {
  q?: string;
  workMode?: string;
  employmentType?: string;
  location?: string;
  datePosted?: string;
  page?: number;
  pageSize?: number;
  cvProfileId?: string;
  remoteFirst?: boolean;
};

function discoveryPlaceholderAllowed(prev: JobDiscoveryParams, next: JobDiscoveryParams): boolean {
  return (
    prev.cvProfileId === next.cvProfileId &&
    prev.q === next.q &&
    prev.location === next.location &&
    prev.workMode === next.workMode &&
    prev.employmentType === next.employmentType &&
    prev.datePosted === next.datePosted &&
    prev.remoteFirst === next.remoteFirst &&
    prev.pageSize === next.pageSize
  );
}

export function useJobDiscovery(params: JobDiscoveryParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.jobs.discovery(params),
    queryFn: () => api.jobDiscovery.discover(params),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    placeholderData: (previousData, previousQuery) => {
      if (!previousData) return undefined;
      const prevParams = previousQuery?.queryKey?.[1] as JobDiscoveryParams | undefined;
      if (!prevParams) return undefined;
      return discoveryPlaceholderAllowed(prevParams, params) ? previousData : undefined;
    },
    enabled,
  });
}
