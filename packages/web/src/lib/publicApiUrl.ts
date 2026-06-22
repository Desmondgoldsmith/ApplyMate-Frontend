/**
 * Normalize `NEXT_PUBLIC_API_URL` — strips accidental spaces (common in Vercel paste)
 * and ensures a trailing slash with `/api` segment.
 */
export function normalizePublicApiUrl(raw?: string | null): string {
  const compact = (raw ?? '').replace(/\s+/g, '');
  if (!compact) return 'http://localhost:3000/api/';

  try {
    const withScheme = compact.includes('://') ? compact : `https://${compact}`;
    const url = new URL(withScheme);
    let path = url.pathname.replace(/\/$/, '') || '';
    if (path === '' || path === '/') {
      path = '/api';
    } else if (!path.startsWith('/api')) {
      path = '/api';
    }
    return `${url.origin}${path}/`;
  } catch {
    return compact.endsWith('/') ? compact : `${compact}/`;
  }
}

export function readNormalizedPublicApiUrl(): string {
  return normalizePublicApiUrl(process.env.NEXT_PUBLIC_API_URL);
}

function isNgrokApiUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl, 'http://localhost').hostname.toLowerCase();
    return host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok-free.dev');
  } catch {
    return false;
  }
}

/** Vercel UI + ngrok-backed Nest — browser uses same-origin `/backend-api/` proxy. */
export function shouldUseProductionNgrokBrowserProxy(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV === 'development') return false;
  const flag = process.env.NEXT_PUBLIC_USE_NGROK_TUNNEL?.trim().toLowerCase();
  if (flag !== 'true') return false;
  return isNgrokApiUrl(readNormalizedPublicApiUrl());
}
