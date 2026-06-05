/**
 * Stores the latest `X-Request-Id` from API responses so PostHog / support
 * can correlate client events with backend structured logs.
 */

let lastRequestId: string | null = null;

export function setLastRequestId(id: string | null | undefined): void {
  const trimmed = id?.trim();
  lastRequestId = trimmed || null;
}

export function getLastRequestId(): string | null {
  return lastRequestId;
}

/** Read `X-Request-Id` from an axios/fetch response headers object. */
export function readRequestIdFromHeaders(
  headers: Record<string, unknown> | undefined,
): string | null {
  if (!headers) return null;
  const raw =
    headers['x-request-id'] ??
    headers['X-Request-Id'] ??
    headers['X-REQUEST-ID'];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}
