import axios from 'axios';

import { getApiErrorCode } from '@/lib/axios';

export const CV_CONTENT_CONFLICT_CODE = 'CV_CONTENT_CONFLICT';

/** The editor saved on top of an older version than the server has (another tab, AI accept, import, restore). */
export function isCvContentConflictError(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 409 &&
    getApiErrorCode(error) === CV_CONTENT_CONFLICT_CODE
  );
}

/**
 * The content version an editor's local data is based on. `null` means unknown (send no base;
 * the next successful save re-establishes it).
 */
export type CvContentVersionRef = { current: number | null };
