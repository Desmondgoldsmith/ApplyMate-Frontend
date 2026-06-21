import type { QueryClient } from '@tanstack/react-query';

import { getApiErrorCode, getApiErrorMessage } from '@/lib/axios';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';

const ACCEPT_PREVIEW_SYNC_CODES = new Set([
  'IMPROVEMENT_STALE_INDEX',
  'IMPROVEMENT_STALE_DRAFT',
  'IMPROVEMENT_INVALID_FIELD_SELECTION',
  'IMPROVEMENT_DRAFT_FIELD_MISMATCH',
]);

function isMissingDraftMessage(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes('no draft found') || msg.includes('run apply first');
}

/** Accept failed because preview is missing or out of sync — never auto-call /apply. */
export function shouldRecoverCvImprovementAcceptPreviewSync(
  error: unknown,
  code?: string | null,
): boolean {
  const resolved = code ?? getApiErrorCode(error);
  if (resolved && ACCEPT_PREVIEW_SYNC_CODES.has(resolved)) return true;
  return isMissingDraftMessage(getApiErrorMessage(error) || '');
}

export function shouldRecoverCvImprovementRejectPreviewSync(
  code: string | null | undefined,
): boolean {
  return Boolean(code && ACCEPT_PREVIEW_SYNC_CODES.has(code));
}

export function cvImprovementAcceptPreviewSyncUserMessage(
  code: string | null | undefined,
  error?: unknown,
): string {
  if (code === 'IMPROVEMENT_DRAFT_FIELD_MISMATCH') {
    return 'The selected fields do not match the stored preview. Close this preview and run Fix with AI again.';
  }
  if (code === 'IMPROVEMENT_INVALID_FIELD_SELECTION') {
    return 'That field selection is not valid for this preview. Close it and run Fix with AI again.';
  }
  if (
    code === 'IMPROVEMENT_STALE_INDEX' ||
    code === 'IMPROVEMENT_STALE_DRAFT' ||
    isMissingDraftMessage(getApiErrorMessage(error) || '')
  ) {
    return 'This preview is out of sync with your CV. Close it and run Fix with AI again.';
  }
  return 'Could not apply this change. Close the preview and run Fix with AI again.';
}

export async function recoverCvImprovementAcceptPreviewSync(options: {
  queryClient: QueryClient;
  profileId: string | null | undefined;
  onClosePreview: () => void;
}): Promise<void> {
  options.onClosePreview();
  const id = options.profileId?.trim();
  if (!id) return;
  await options.queryClient.invalidateQueries({
    queryKey: cvSuggestionsQueryKey(id),
    exact: true,
  });
}
