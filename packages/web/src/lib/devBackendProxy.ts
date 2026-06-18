/** Nest API origin for local dev proxy (`/backend-api/*` → `:3000/api/*`). */
export function resolveNestApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3000/api/';
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

/** Max wait for upstream Nest before returning 502 (avoids hung proxy sockets). */
export const DEV_BACKEND_PROXY_TIMEOUT_MS = 90_000;

export const BACKEND_UNREACHABLE_ERROR_CODE = 'BACKEND_UNREACHABLE' as const;
export const BACKEND_TIMEOUT_ERROR_CODE = 'BACKEND_TIMEOUT' as const;
