import { queryKeys } from '@/lib/queryKeys';
import type { QueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';

export const CV_READY_TOAST = 'Your CV is ready — here it is.';

/** Invalidate and prefetch editor queries so the builder is populated on arrival. */
export async function prefetchCvProfileForEditor(
  queryClient: QueryClient,
  profileId: string,
): Promise<void> {
  const id = profileId.trim();
  if (!id) return;

  await queryClient.invalidateQueries({ queryKey: queryKeys.cv.profiles() });
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.cv.profile(id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cv.sections(id) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.cv.profileDefault() }),
  ]);

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.cv.profile(id),
      queryFn: () => api.cv.getProfileById(id),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.cv.sections(id),
      queryFn: () => api.cv.getSections(true, id),
    }),
  ]);
}

export function cvEditorPath(profileId: string): string {
  return `/dashboard/cv?profileId=${encodeURIComponent(profileId.trim())}`;
}
