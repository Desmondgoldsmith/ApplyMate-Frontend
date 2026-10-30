import type { CvRevisionReason } from '@/lib/api';

const CV_REVISION_REASON_LABELS: Record<string, string> = {
  cv_upload: 'Before uploading a new CV file',
  cv_text_import: 'Before importing CV text',
  accept_all: 'Before accepting all suggestions',
  tailor_accept: 'Before applying tailored changes',
  tailor_revert: 'Before undoing a tailored change',
  before_restore: 'Before restoring an earlier version',
};

export const CV_REVISION_FALLBACK_LABEL = 'Saved version';

export function cvRevisionReasonLabel(reason: CvRevisionReason): string {
  return CV_REVISION_REASON_LABELS[reason] ?? CV_REVISION_FALLBACK_LABEL;
}

export const CV_VERSIONS_EMPTY_MESSAGE =
  'No saved versions yet. CareerKite saves one automatically before big changes like uploading a new CV.';

export const CV_VERSION_NOT_AVAILABLE_MESSAGE = 'Version not available';

export const CV_VERSION_RESTORED_MESSAGE = 'Version restored.';

export const CV_VERSION_SAVED_AFTER_UPLOAD_MESSAGE =
  'Your previous version was saved.';

export const CV_VERSION_SAVED_BEFORE_ACCEPT_ALL_MESSAGE =
  'Saved a copy before applying all suggestions.';

export const CV_VIEW_VERSIONS_LABEL = 'View versions';
