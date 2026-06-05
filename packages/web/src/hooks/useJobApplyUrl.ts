'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

import { resolveJobApplyUrl } from '@/lib/jobApplyUrl';
import { isValidExternalApplyUrl } from '@/lib/jobApplyUrlPick';

export function useJobApplyUrl(opts: {
  applyUrl?: string | null;
  jobListingId?: string | null;
  enabled?: boolean;
}) {
  const direct = isValidExternalApplyUrl(opts.applyUrl) ? opts.applyUrl.trim() : null;
  const listingId = opts.jobListingId?.trim() ?? '';
  const enabled = opts.enabled !== false && !direct && Boolean(listingId);

  const q = useQuery({
    queryKey: queryKeys.jobs.applyUrl(listingId),
    queryFn: () => resolveJobApplyUrl({ jobListingId: listingId }),
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return {
    applyUrl: direct ?? q.data ?? null,
    isLoading: enabled && q.isLoading,
  };
}
