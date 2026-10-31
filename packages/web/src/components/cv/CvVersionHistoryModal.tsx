'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { History, Loader2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  api,
  type CvRevisionRestoreResult,
  type CvRevisionSummary,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import {
  CV_VERSION_NOT_AVAILABLE_MESSAGE,
  CV_VERSION_RESTORED_MESSAGE,
  CV_VERSIONS_EMPTY_MESSAGE,
  cvRevisionReasonLabel,
} from '@/lib/cvRevisions';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { queryKeys } from '@/lib/queryKeys';
import { refreshCvState } from '@/lib/refreshCvState';

function isNotFoundError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

export type CvVersionHistoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string | null;
  /** Local undo/redo refers to the replaced content, so it must be emptied after a restore. */
  clearUndoHistory: () => void;
  /** After caches are refreshed — e.g. re-sync the template and rehydrate the editor. */
  onRestored?: (result: CvRevisionRestoreResult) => void;
  /** When set, Restore is disabled and this hint is shown (e.g. edits still saving). */
  restoreBlockedReason?: string | null;
};

export function CvVersionHistoryModal({
  open,
  onOpenChange,
  profileId,
  clearUndoHistory,
  onRestored,
  restoreBlockedReason = null,
}: CvVersionHistoryModalProps) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const id = profileId?.trim() ?? '';
  const [confirmTarget, setConfirmTarget] = useState<CvRevisionSummary | null>(
    null,
  );

  const revisionsQ = useQuery({
    queryKey: queryKeys.cv.revisions(id),
    queryFn: () => api.cv.listRevisions(id),
    enabled: open && id.length > 0,
    staleTime: 0,
    retry: (failureCount, error) => !isNotFoundError(error) && failureCount < 2,
  });

  const restore = useMutation({
    mutationFn: (revisionId: string) => api.cv.restoreRevision(id, revisionId),
  });

  const handleConfirmRestore = async () => {
    if (!confirmTarget || !id) return;
    try {
      const result = await restore.mutateAsync(confirmTarget.id);
      await Promise.all([
        refreshCvState(queryClient, id, {
          refreshProfile: true,
          refreshSuggestions: true,
          invalidateScore: true,
          invalidateCvProfilesList: true,
        }),
        /** Prefix match also refreshes the include-hidden section lists for this CV. */
        queryClient.refetchQueries({ queryKey: queryKeys.cv.sections(id) }),
      ]);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cv.profileDefault(),
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cv.revisions(id),
        exact: true,
      });
      clearUndoHistory();
      onRestored?.(result);
      toast.success(CV_VERSION_RESTORED_MESSAGE);
      setConfirmTarget(null);
      onOpenChange(false);
    } catch (e) {
      if (isNotFoundError(e)) {
        toast.error(`${CV_VERSION_NOT_AVAILABLE_MESSAGE}.`);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.cv.revisions(id),
          exact: true,
        });
      } else {
        toast.error(getApiErrorMessage(e));
      }
      throw e;
    }
  };

  const revisions = revisionsQ.data ?? [];
  const restoreDisabled = restore.isPending || Boolean(restoreBlockedReason);

  let body: ReactNode;
  if (!id || (revisionsQ.isError && isNotFoundError(revisionsQ.error))) {
    body = (
      <p className="py-6 text-center text-sm text-text-tertiary">
        {CV_VERSION_NOT_AVAILABLE_MESSAGE}
      </p>
    );
  } else if (revisionsQ.isPending) {
    body = (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-text-tertiary">
        <Loader2
          className="h-4 w-4 animate-spin text-accent-text"
          aria-hidden
        />
        Loading versions…
      </div>
    );
  } else if (revisionsQ.isError) {
    body = (
      <div className="space-y-3 py-4 text-center">
        <p className="text-sm text-danger-text">
          {getApiErrorMessage(revisionsQ.error)}
        </p>
        <Button
          type="button"
          variant="ghost"
          className="border border-border-subtle text-xs"
          onClick={() => void revisionsQ.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  } else if (revisions.length === 0) {
    body = (
      <p className="py-6 text-center text-sm leading-relaxed text-text-tertiary">
        {CV_VERSIONS_EMPTY_MESSAGE}
      </p>
    );
  } else {
    body = (
      <ul className="divide-y divide-white/[0.06]" aria-label="Saved versions">
        {revisions.map((rev) => (
          <li key={rev.id} className="flex items-center gap-3 py-3">
            <History
              className="h-4 w-4 shrink-0 text-accent-text"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">
                {cvRevisionReasonLabel(rev.reason)}
              </p>
              <p
                className="text-xs text-text-tertiary"
                title={formatFullDate(rev.createdAt)}
              >
                {formatRelativeEdited(rev.createdAt)}
                {rev.sectionCount > 0
                  ? ` · ${rev.sectionCount} section${rev.sectionCount === 1 ? '' : 's'}`
                  : null}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="shrink-0 border border-border-subtle text-xs"
              disabled={restoreDisabled}
              onClick={() => setConfirmTarget(rev)}
            >
              {restore.isPending && restore.variables === rev.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : null}
              Restore
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Version history"
        description="Saved automatically while you edit and before big or AI changes. Restoring keeps your current CV as a version too, so you can switch back."
        className="max-w-lg"
        scrollBody
      >
        {restoreBlockedReason && revisions.length > 0 ? (
          <p className="mb-2 rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-xs text-warning-text">
            {restoreBlockedReason}
          </p>
        ) : null}
        {body}
      </Modal>
      <ConfirmModal
        open={confirmTarget !== null}
        onOpenChange={(next) => {
          if (!next && !restore.isPending) setConfirmTarget(null);
        }}
        title="Restore this version?"
        description="Your current CV will be saved as a version too, so you can switch back."
        confirmLabel="Restore"
        isPending={restore.isPending}
        onConfirm={handleConfirmRestore}
        layerZIndex={110}
      />
    </>
  );
}
