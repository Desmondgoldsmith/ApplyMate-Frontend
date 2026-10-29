import axios from 'axios';

import { getApiErrorCode, getApiErrorMessage } from '@/lib/axios';
import { BACKEND_TIMEOUT_ERROR_CODE } from '@/lib/devBackendProxy';

export const CV_EXPORT_TIMEOUT_MESSAGE =
  'Your PDF is taking longer than usual. Please try again in a moment.';

export const CV_EXPORT_NOT_FOUND_MESSAGE =
  "We couldn't find that CV. Refresh the page and try again.";

export const CV_EXPORT_GENERIC_MESSAGE = 'Could not download CV';

/** Client timeout, API `REQUEST_TIMEOUT` (504), or the Next proxy giving up on the API. */
export function isCvExportTimeoutError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') return true;
  const code = getApiErrorCode(error);
  return (
    error.response?.status === 504 ||
    code === 'REQUEST_TIMEOUT' ||
    code === BACKEND_TIMEOUT_ERROR_CODE
  );
}

/** Toast copy for a failed CV export (expects the JSON body already parsed from the Blob). */
export function getCvExportErrorMessage(
  error: unknown,
  fallback: string = CV_EXPORT_GENERIC_MESSAGE,
): string {
  if (isCvExportTimeoutError(error)) return CV_EXPORT_TIMEOUT_MESSAGE;
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 404 || status === 403) return CV_EXPORT_NOT_FOUND_MESSAGE;
  }
  return getApiErrorMessage(error) || fallback;
}
