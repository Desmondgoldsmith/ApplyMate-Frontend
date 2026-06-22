/** Decode unverified Google ID token claims for OAuth diagnostics (server-only). */
export function decodeGoogleIdTokenClaims(
  idToken: string,
): { aud?: string; email?: string; iss?: string } | null {
  const part = idToken.trim().split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json =
      typeof Buffer !== 'undefined'
        ? Buffer.from(b64 + pad, 'base64').toString('utf8')
        : atob(b64 + pad);
    const payload = JSON.parse(json) as {
      aud?: unknown;
      email?: unknown;
      iss?: unknown;
    };
    return {
      aud: typeof payload.aud === 'string' ? payload.aud : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      iss: typeof payload.iss === 'string' ? payload.iss : undefined,
    };
  } catch {
    return null;
  }
}
