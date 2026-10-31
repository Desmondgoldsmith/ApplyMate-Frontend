import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CvVersionHistoryModal } from '@/components/cv/CvVersionHistoryModal';
import type { CvRevisionRestoreResult, CvRevisionSummary } from '@/lib/api';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';
import { queryKeys } from '@/lib/queryKeys';

const { listRevisions, restoreRevision, toastSuccess, toastError } = vi.hoisted(
  () => ({
    listRevisions: vi.fn(),
    restoreRevision: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
  }),
);

vi.mock('@/lib/api', () => ({
  api: { cv: { listRevisions, restoreRevision } },
}));

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn() }),
}));

const PROFILE_ID = 'profile-1';
const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

function revision(
  id: string,
  reason: string,
  sectionCount = 7,
): CvRevisionSummary {
  return { id, reason, createdAt: TWO_HOURS_AGO, sectionCount };
}

function notFoundError(): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError(
    'Request failed with status code 404',
    AxiosError.ERR_BAD_REQUEST,
    config,
    undefined,
    {
      data: {
        success: false,
        error: { statusCode: 404, message: 'CV profile not found' },
      },
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config,
    },
  );
}

function renderModal(
  props: Partial<Parameters<typeof CvVersionHistoryModal>[0]> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const clearUndoHistory = vi.fn();
  const onRestored = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <CvVersionHistoryModal
        open
        onOpenChange={onOpenChange}
        profileId={PROFILE_ID}
        clearUndoHistory={clearUndoHistory}
        onRestored={onRestored}
        {...props}
      />
    </QueryClientProvider>,
  );
  return { queryClient, clearUndoHistory, onRestored, onOpenChange };
}

async function openConfirmAndRestore(
  user: ReturnType<typeof userEvent.setup>,
  rowIndex = 0,
) {
  const rows = await screen.findAllByRole('listitem');
  await user.click(
    within(rows[rowIndex]!).getByRole('button', { name: 'Restore' }),
  );
  const dialogs = await screen.findAllByRole('dialog');
  const confirm = dialogs[dialogs.length - 1]!;
  expect(
    within(confirm).getByText('Restore this version?'),
  ).toBeInTheDocument();
  await user.click(within(confirm).getByRole('button', { name: 'Restore' }));
}

describe('CvVersionHistoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('labels each version from its reason with a relative time', async () => {
    listRevisions.mockResolvedValueOnce([
      revision('r1', 'cv_upload'),
      revision('r2', 'cv_text_import'),
      revision('r3', 'accept_all'),
      revision('r4', 'tailor_accept'),
      revision('r5', 'before_restore', 1),
      revision('r6', 'something_new'),
    ]);
    renderModal();

    expect(
      await screen.findByText('Before uploading a new CV file'),
    ).toBeInTheDocument();
    expect(screen.getByText('Before importing CV text')).toBeInTheDocument();
    expect(
      screen.getByText('Before accepting all suggestions'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Before applying tailored changes'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Before restoring an earlier version'),
    ).toBeInTheDocument();
    expect(screen.getByText('Saved version')).toBeInTheDocument();
    expect(screen.getAllByText(/2 hours ago/)).toHaveLength(6);
    expect(screen.getByText(/2 hours ago · 1 section$/)).toBeInTheDocument();
    expect(listRevisions).toHaveBeenCalledWith(PROFILE_ID);
  });

  it('shows the empty state when no versions exist', async () => {
    listRevisions.mockResolvedValueOnce([]);
    renderModal();

    expect(
      await screen.findByText(
        'No saved versions yet. CareerKite saves one automatically while you edit and before big or AI changes.',
      ),
    ).toBeInTheDocument();
  });

  it('shows "Version not available" when the profile is not the user\'s', async () => {
    listRevisions.mockRejectedValueOnce(notFoundError());
    renderModal();

    expect(
      await screen.findByText('Version not available'),
    ).toBeInTheDocument();
  });

  it('restores a version, refreshes CV queries, clears undo history and confirms', async () => {
    listRevisions.mockResolvedValue([revision('r1', 'cv_upload')]);
    const result: CvRevisionRestoreResult = {
      restored: true,
      revisionId: 'r1',
      sections: [],
    };
    restoreRevision.mockResolvedValueOnce(result);
    const user = userEvent.setup();
    const { queryClient, clearUndoHistory, onRestored, onOpenChange } =
      renderModal();
    const refetch = vi.spyOn(queryClient, 'refetchQueries');
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await openConfirmAndRestore(user);

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('Version restored.'),
    );
    expect(restoreRevision).toHaveBeenCalledWith(PROFILE_ID, 'r1');
    expect(clearUndoHistory).toHaveBeenCalledTimes(1);
    expect(onRestored).toHaveBeenCalledWith(result);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    const refetchedKeys = refetch.mock.calls.map(
      ([filters]) => filters?.queryKey,
    );
    expect(refetchedKeys).toEqual(
      expect.arrayContaining([
        queryKeys.cv.profile(PROFILE_ID),
        queryKeys.cv.sections(PROFILE_ID),
        cvSuggestionsQueryKey(PROFILE_ID),
      ]),
    );
    const invalidatedKeys = invalidate.mock.calls.map(
      ([filters]) => filters?.queryKey,
    );
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        queryKeys.cv.score(PROFILE_ID),
        queryKeys.cv.profiles(),
        queryKeys.cv.revisions(PROFILE_ID),
      ]),
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it('shows "Version not available." and keeps undo history when the restore 404s', async () => {
    listRevisions.mockResolvedValue([revision('r1', 'cv_upload')]);
    restoreRevision.mockRejectedValueOnce(notFoundError());
    const user = userEvent.setup();
    const { clearUndoHistory, onRestored } = renderModal();

    await openConfirmAndRestore(user);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('Version not available.'),
    );
    expect(clearUndoHistory).not.toHaveBeenCalled();
    expect(onRestored).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('disables Restore while the editor still has unsaved edits', async () => {
    listRevisions.mockResolvedValueOnce([revision('r1', 'cv_upload')]);
    renderModal({ restoreBlockedReason: 'Saving your latest edits.' });

    const rows = await screen.findAllByRole('listitem');
    expect(
      within(rows[0]!).getByRole('button', { name: 'Restore' }),
    ).toBeDisabled();
    expect(screen.getByText('Saving your latest edits.')).toBeInTheDocument();
  });
});
