'use client';

import { useQuery } from '@tanstack/react-query';

import { api, type CvProfileSummary } from '@/lib/api';

/**
 * Rows from GET /cv/profiles only (backend contract).
 * If this is empty but GET /cv/profile returns a profile, treat as inconsistency — do not synthesize list rows here.
 */
export type CvProfilesQueryData = {
  rows: CvProfileSummary[];
};

async function fetchCvProfileRows(): Promise<CvProfilesQueryData> {
  const rows = await api.cv.listProfiles();
  return { rows };
}

export function useCVProfiles() {
  return useQuery({
    queryKey: ['cv-profiles'],
    queryFn: fetchCvProfileRows,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function cvProfileDisplayCount(data: CvProfilesQueryData | undefined): number {
  return data?.rows.length ?? 0;
}
