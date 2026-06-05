import type { HubReminderStatus } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

export type HubNoteScope =
  | { kind: 'application'; applicationId: string }
  | { kind: 'job-analysis'; jobAnalysisId: string }
  | { kind: 'bookmark'; bookmarkId: string };

export function hubNoteScopeFromJob(job: {
  applicationId?: string | null;
  jobAnalysisId?: string | null;
  hubBookmarkId?: string | null;
}): HubNoteScope | null {
  if (job.applicationId) return { kind: 'application', applicationId: job.applicationId };
  if (job.jobAnalysisId) return { kind: 'job-analysis', jobAnalysisId: job.jobAnalysisId };
  if (job.hubBookmarkId) return { kind: 'bookmark', bookmarkId: job.hubBookmarkId };
  return null;
}

export function hubNotesQueryKey(scope: HubNoteScope) {
  switch (scope.kind) {
    case 'application':
      return queryKeys.hub.notesApplication(scope.applicationId);
    case 'job-analysis':
      return queryKeys.hub.notesJobAnalysis(scope.jobAnalysisId);
    case 'bookmark':
      return queryKeys.hub.notesBookmark(scope.bookmarkId);
  }
}

export function hubNotesGlobalQueryKey(cursor?: string | null) {
  return queryKeys.hub.notesGlobal(cursor ?? '');
}

export function hubRemindersFilterKey(filter: {
  jobAnalysisId?: string;
  jobBookmarkId?: string;
  status?: HubReminderStatus;
}) {
  return queryKeys.hub.remindersFilter({
    jobAnalysisId: filter.jobAnalysisId,
    jobBookmarkId: filter.jobBookmarkId,
    status: filter.status,
  });
}

export function hubRemindersJobDetailKey(jobAnalysisId: string) {
  return queryKeys.hub.remindersJobDetail(jobAnalysisId);
}
