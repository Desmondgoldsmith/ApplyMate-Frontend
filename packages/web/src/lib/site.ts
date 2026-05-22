/**
 * Canonical site URL and shared marketing metadata.
 * Set NEXT_PUBLIC_SITE_URL in production (e.g. https://applymate.com).
 */
export const SITE_NAME = 'ApplyMate';

export const SITE_TAGLINE = 'AI job application assistant';

export const SITE_DESCRIPTION =
  'ApplyMate scores your CV against any job, tailors applications, tracks your pipeline, and helps you apply smarter — from first click to offer.';

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (!raw) return 'http://localhost:3000';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

export const DEFAULT_OG_IMAGE_PATH = '/opengraph-image';

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
