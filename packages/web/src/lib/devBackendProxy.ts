import { isNgrokFreeTunnel } from '@/lib/ngrokTunnel';

/** Nest API origin for local dev proxy (`/backend-api/*` → upstream `/api/*`). */
export function resolveNestApiOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3000/api/';
  try {
    return new URL(raw).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

/** True when `NEXT_PUBLIC_API_URL` points at a free ngrok tunnel (needs skip header on server proxy). */
export function isDevBackendNgrokTunnel(): boolean {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  return Boolean(raw && isNgrokFreeTunnel(raw));
}

export function devBackendProxyUnreachableMessage(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || 'http://localhost:3000/api/';
  if (isNgrokFreeTunnel(raw)) {
    return `Cannot reach the API via ngrok (${raw}). Confirm \`ngrok http 3000\` is running, Nest is on port 3000, and NEXT_PUBLIC_API_URL has no spaces (e.g. https://YOUR.ngrok-free.dev/api/).`;
  }
  return 'Cannot reach the API server. Confirm Nest is running on port 3000 (or your NEXT_PUBLIC_API_URL) and try again.';
}

/** Max wait for upstream Nest before returning 502 (avoids hung proxy sockets). */
export const DEV_BACKEND_PROXY_TIMEOUT_MS = 90_000;

export const BACKEND_UNREACHABLE_ERROR_CODE = 'BACKEND_UNREACHABLE' as const;
export const BACKEND_TIMEOUT_ERROR_CODE = 'BACKEND_TIMEOUT' as const;
