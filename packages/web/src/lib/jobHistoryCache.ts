import type { QueryClient } from '@tanstack/react-query';

import type { JobHistoryItem } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

/** After detail fetch, align list card scores with derived `GET /jobs/:id` headline. */
export function patchJobHistoryDisplayScore(
  queryClient: QueryClient,
  jobAnalysisId: string,
  matchScore: number,
): void {
  const id = jobAnalysisId.trim();
  if (!id || !Number.isFinite(matchScore)) return;

  for (const includeAccepted of [false, true] as const) {
    queryClient.setQueryData<JobHistoryItem[]>(
      queryKeys.jobs.history(includeAccepted),
      (old) =>
        old?.map((item) =>
          item.id === id ? { ...item, matchScore } : item,
        ),
    );
  }
}
