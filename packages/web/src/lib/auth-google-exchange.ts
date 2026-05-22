import { normalizeAuthResponse } from '@/lib/auth-response';
import type { AuthUser } from '@/lib/api';

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.endsWith('/') ? fromEnv.slice(0, -1) : fromEnv;
  }
  return 'http://localhost:3000/api';
}

type GoogleAuthPayload = {
  idToken: string;
  name?: string;
  image?: string;
};

/**
 * Exchange a Google ID token for ApplyMate access token + user (same contract as POST /auth/login).
 */
export async function exchangeGoogleIdTokenWithBackend(
  payload: GoogleAuthPayload,
): Promise<{ accessToken: string; user: AuthUser }> {
  const url = `${resolveApiBaseUrl()}/auth/google`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      idToken: payload.idToken,
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.image ? { image: payload.image } : {}),
    }),
    cache: 'no-store',
  });

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'message' in data &&
      typeof (data as { message: unknown }).message === 'string'
        ? (data as { message: string }).message
        : `Google sign-in failed (${res.status})`;
    throw new Error(message);
  }

  const normalized = normalizeAuthResponse(data, undefined);
  return {
    accessToken: normalized.accessToken,
    user: {
      ...normalized.user,
      name: normalized.user.name ?? payload.name,
      image: normalized.user.image ?? payload.image,
    },
  };
}
