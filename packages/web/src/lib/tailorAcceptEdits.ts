import axios from 'axios';

import { getApiErrorCode } from '@/lib/axios';

export const TAILOR_SECTION_CHANGED_CODE = 'TAILOR_SECTION_CHANGED';

export const TAILOR_OVERWRITE_EDITS_PROMPT =
  'You edited this part of your CV after the suggestion was made.\n\nReplace your edits with the suggestion?';

export const TAILOR_KEPT_EDITS_MESSAGE =
  'Kept your edits. Tailor again for a fresh suggestion.';

export function isTailorSectionChangedError(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 409 &&
    getApiErrorCode(error) === TAILOR_SECTION_CHANGED_CODE
  );
}

/**
 * Runs a tailor accept. When the server reports the user edited the section after the
 * suggestion was made, asks before replacing those edits. Resolves to `null` if they keep them.
 */
export async function acceptRespectingEdits<T>(
  run: (overwriteEdits: boolean) => Promise<T>,
  confirmOverwrite: (message: string) => boolean = (message) =>
    window.confirm(message),
): Promise<T | null> {
  try {
    return await run(false);
  } catch (e) {
    if (!isTailorSectionChangedError(e)) throw e;
    if (!confirmOverwrite(TAILOR_OVERWRITE_EDITS_PROMPT)) return null;
    return run(true);
  }
}
