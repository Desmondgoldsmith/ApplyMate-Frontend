'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useToast } from '@/components/ui/Toast';
import { api, type JobListingDto } from '@/lib/api';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';
import { getApiErrorMessage } from '@/lib/axios';

type BookmarkMutationResult =
  | { action: 'added'; bookmarkId: string; jobListingId: string }
  | { action: 'removed'; jobListingId: string };

export function useBookmarkJob() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      bookmarked,
    }: {
      id: string;
      bookmarked: boolean;
    }): Promise<BookmarkMutationResult> => {
      if (bookmarked) {
        await api.jobDiscovery.removeBookmark(id);
        return { action: 'removed', jobListingId: id };
      }
      const r = await api.jobDiscovery.bookmark(id);
      return {
        action: 'added',
        bookmarkId: r.bookmarkId,
        jobListingId: r.jobListingId,
      };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['job-discovery-detail', variables.id] });
      const previous = queryClient.getQueryData<JobListingDto>(['job-discovery-detail', variables.id]);
      if (previous) {
        queryClient.setQueryData(['job-discovery-detail', variables.id], {
          ...previous,
          isBookmarked: !variables.bookmarked,
        });
      }
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['job-discovery-detail', variables.id], context.previous);
      }
      toast.error(getApiErrorMessage(err));
    },
    onSuccess: (data) => {
      const listingKey = data.jobListingId;
      if (data.action === 'added') {
        queryClient.setQueryData<JobListingDto | undefined>(['job-discovery-detail', listingKey], (old) =>
          old
            ? {
                ...old,
                isBookmarked: true,
                ...(data.bookmarkId ? { bookmarkRowId: data.bookmarkId } : {}),
              }
            : old,
        );
        toast.success('Bookmarked — this role is saved; open Job Hub to work it.');
      } else {
        queryClient.setQueryData<JobListingDto | undefined>(['job-discovery-detail', listingKey], (old) =>
          old ? { ...old, isBookmarked: false, bookmarkRowId: undefined } : old,
        );
        toast.success('Bookmark removed.');
      }
      void queryClient.invalidateQueries({ queryKey: ['job-discovery'] });
      /** Do not invalidate detail here: GET /job-discovery/:id may omit `isBookmarked`, and a refetch would clear the optimistic update. */
      void queryClient.invalidateQueries({ queryKey: ['hub-bookmarks'] });
      invalidateTodayPlanQueries(queryClient);
    },
  });
}
