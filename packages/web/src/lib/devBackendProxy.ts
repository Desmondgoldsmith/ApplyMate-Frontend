import { isNgrokFreeTunnel } from '@/lib/ngrokTunnel';
import { readNormalizedPublicApiUrl } from '@/lib/publicApiUrl';

/** Nest API origin for dev / Vercel proxy (`/backend-api/*` → upstream `/api/*`). */
export function resolveNestApiOrigin(): string {
  try {
    return new URL(readNormalizedPublicApiUrl()).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

/** True when `NEXT_PUBLIC_API_URL` points at a free ngrok tunnel (needs skip header on server proxy). */
export function isDevBackendNgrokTunnel(): boolean {
  return isNgrokFreeTunnel(readNormalizedPublicApiUrl());
}

export function devBackendProxyUnreachableMessage(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? '';
  const normalized = readNormalizedPublicApiUrl();
  if (raw.replace(/\s+/g, '') !== normalized.replace(/\s+/g, '')) {
    return `NEXT_PUBLIC_API_URL looks malformed (remove spaces). Use exactly: ${normalized}`;
  }
  if (isNgrokFreeTunnel(normalized)) {
    return `Cannot reach the API via ngrok (${normalized}). Confirm ngrok http 3000 is running, Nest is on port 3000, and CORS_ORIGIN=https://apply-mate-frontend.vercel.app on Nest.`;
  }
  return 'Cannot reach the API server. Confirm Nest is running on port 3000 (or your NEXT_PUBLIC_API_URL) and try again.';
}

/** Max wait for upstream Nest before returning 502 (avoids hung proxy sockets). */
export const DEV_BACKEND_PROXY_TIMEOUT_MS = 90_000;

export const BACKEND_UNREACHABLE_ERROR_CODE = 'BACKEND_UNREACHABLE' as const;
export const BACKEND_TIMEOUT_ERROR_CODE = 'BACKEND_TIMEOUT' as const;
