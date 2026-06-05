'use client';

import { queryKeys } from '@/lib/queryKeys';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api, type HubNoteEntry } from '@/lib/api';
import {
  hubNotesQueryKey,
  type HubNoteScope,
} from '@/lib/hubNotesQueryKeys';
import { invalidateTodayPlanQueries } from '@/lib/today-plan';

function fetchHubNotes(scope: HubNoteScope): Promise<HubNoteEntry[]> {
  switch (scope.kind) {
    case 'application':
      return api.applications.listNotes(scope.applicationId);
    case 'job-analysis':
      return api.jobs.listNotes(scope.jobAnalysisId);
    case 'bookmark':
      return api.jobDiscovery.listBookmarkNotes(scope.bookmarkId);
  }
}

function createHubNote(scope: HubNoteScope, body: string): Promise<HubNoteEntry> {
  switch (scope.kind) {
    case 'application':
      return api.applications.createNote(scope.applicationId, body);
    case 'job-analysis':
      return api.jobs.createNote(scope.jobAnalysisId, body);
    case 'bookmark':
      return api.jobDiscovery.createBookmarkNote(scope.bookmarkId, body);
  }
}

function updateHubNote(
  scope: HubNoteScope,
  noteId: string,
  body: string,
): Promise<HubNoteEntry> {
  switch (scope.kind) {
    case 'application':
      return api.applications.updateNote(scope.applicationId, noteId, body);
    case 'job-analysis':
      return api.jobs.updateNote(scope.jobAnalysisId, noteId, body);
    case 'bookmark':
      return api.jobDiscovery.updateBookmarkNote(scope.bookmarkId, noteId, body);
  }
}

function deleteHubNote(scope: HubNoteScope, noteId: string): Promise<void> {
  switch (scope.kind) {
    case 'application':
      return api.applications.deleteNote(scope.applicationId, noteId);
    case 'job-analysis':
      return api.jobs.deleteNote(scope.jobAnalysisId, noteId);
    case 'bookmark':
      return api.jobDiscovery.deleteBookmarkNote(scope.bookmarkId, noteId);
  }
}

function tempNoteId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function invalidateNoteSideEffects(
  queryClient: ReturnType<typeof useQueryClient>,
  scope: HubNoteScope,
  jobAnalysisId?: string | null,
) {
  void queryClient.invalidateQueries({ queryKey: hubNotesQueryKey(scope) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.hub.notesRoot() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.applications.root() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.hub.bookmarks() });
  if (jobAnalysisId) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.jobs.analysis(jobAnalysisId) });
  }
  invalidateTodayPlanQueries(queryClient);
}

export function useHubNotes(
  scope: HubNoteScope | null,
  opts?: { jobAnalysisId?: string | null },
) {
  const queryClient = useQueryClient();
  const queryKey = scope ? hubNotesQueryKey(scope) : queryKeys.hub.notesDisabled();

  const query = useQuery({
    queryKey,
    queryFn: () => fetchHubNotes(scope!),
    enabled: Boolean(scope),
  });

  const createNote = useMutation({
    mutationFn: (body: string) => createHubNote(scope!, body.trim()),
    onMutate: async (body) => {
      if (!scope) return {};
      const trimmed = body.trim();
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HubNoteEntry[]>(queryKey);
      const now = new Date().toISOString();
      const optimistic: HubNoteEntry = {
        id: tempNoteId(),
        body: trimmed,
        snippet: trimmed.split(/\r?\n/)[0]?.slice(0, 72) ?? '—',
        createdAt: now,
        updatedAt: null,
      };
      queryClient.setQueryData<HubNoteEntry[]>(queryKey, (old) => [
        optimistic,
        ...(old ?? []),
      ]);
      return { previous, tempId: optimistic.id };
    },
    onSuccess: (serverRow, _body, ctx) => {
      if (!scope || !ctx?.tempId) return;
      queryClient.setQueryData<HubNoteEntry[]>(queryKey, (old) =>
        (old ?? []).map((row) => (row.id === ctx.tempId ? serverRow : row)),
      );
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: () => {
      if (scope) invalidateNoteSideEffects(queryClient, scope, opts?.jobAnalysisId);
    },
  });

  const updateNote = useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) =>
      updateHubNote(scope!, noteId, body.trim()),
    onMutate: async ({ noteId, body }) => {
      if (!scope) return {};
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HubNoteEntry[]>(queryKey);
      const trimmed = body.trim();
      queryClient.setQueryData<HubNoteEntry[]>(queryKey, (old) =>
        (old ?? []).map((row) =>
          row.id === noteId
            ? {
                ...row,
                body: trimmed,
                snippet: trimmed.split(/\r?\n/)[0]?.slice(0, 72) ?? row.snippet,
                updatedAt: new Date().toISOString(),
              }
            : row,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: () => {
      if (scope) invalidateNoteSideEffects(queryClient, scope, opts?.jobAnalysisId);
    },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => deleteHubNote(scope!, noteId),
    onMutate: async (noteId) => {
      if (!scope) return {};
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<HubNoteEntry[]>(queryKey);
      queryClient.setQueryData<HubNoteEntry[]>(queryKey, (old) =>
        (old ?? []).filter((row) => row.id !== noteId),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKey, ctx.previous);
      }
    },
    onSettled: () => {
      if (scope) invalidateNoteSideEffects(queryClient, scope, opts?.jobAnalysisId);
    },
  });

  return {
    query,
    rows: query.data ?? [],
    createNote,
    updateNote,
    deleteNote,
    isMutating:
      createNote.isPending || updateNote.isPending || deleteNote.isPending,
  };
}
