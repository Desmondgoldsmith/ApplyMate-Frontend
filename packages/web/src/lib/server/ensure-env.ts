import fs from 'node:fs';
import path from 'node:path';

import { loadEnvConfig } from '@next/env';

import { NEXTAUTH_API_BASE_PATH } from '@/lib/nextauth-api';

declare global {
  var __applymateServerEnvLoaded: boolean | undefined;
}

/**
 * NextAuth v4 `parseUrl()` treats a bare origin (`http://localhost:3001`) as `/api/auth`.
 * Handlers live at `/api/auth` (NextAuth default). On Vercel, `detectOrigin()` uses the
 * host only — a custom `/api/nextauth` base caused redirect_uri_mismatch in production.
 */
/** Strip accidental whitespace/quotes from auth secrets (common Vercel copy-paste issue). */
export function normalizeAuthSecrets(): void {
  for (const key of [
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
  ] as const) {
    const raw = process.env[key];
    if (typeof raw !== 'string') continue;
    let value = raw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    if (value) process.env[key] = value;
  }
}

export function normalizeNextAuthUrl(): void {
  normalizeAuthSecrets();
  const raw = process.env.NEXTAUTH_URL?.trim();
  if (!raw) return;
  try {
    const url = new URL(raw);
    const path = url.pathname.replace(/\/$/, '') || '';
    if (
      path === '' ||
      path === '/' ||
      path === '/api/nextauth'
    ) {
      url.pathname = NEXTAUTH_API_BASE_PATH;
      process.env.NEXTAUTH_URL = `${url.origin}${NEXTAUTH_API_BASE_PATH}`;
    }
  } catch {
    /* ignore invalid NEXTAUTH_URL */
  }
}

function resolveWebAndRepoRoot(): { webDir: string; repoRoot: string } {
  const cwd = process.cwd();
  const normalized = cwd.replace(/\\/g, '/');
  if (normalized.endsWith('packages/web')) {
    return { webDir: cwd, repoRoot: path.join(cwd, '../..') };
  }
  const webDir = path.join(cwd, 'packages/web');
  return { webDir, repoRoot: cwd };
}

/** Load repo-root + package `.env` into `process.env` (monorepo). Idempotent. */
export function ensureServerEnv(): void {
  if (!globalThis.__applymateServerEnvLoaded) {
    globalThis.__applymateServerEnvLoaded = true;

    const { webDir, repoRoot } = resolveWebAndRepoRoot();
    const dev = process.env.NODE_ENV !== 'production';

    loadEnvConfig(repoRoot, dev);
    loadEnvConfig(webDir, dev);

    // Fallback: Turbopack workers may not pick up loadEnvConfig — parse root `.env` directly.
    const rootEnv = path.join(repoRoot, '.env');
    if (!process.env.GOOGLE_CLIENT_ID?.trim() && fs.existsSync(rootEnv)) {
      const content = fs.readFileSync(rootEnv, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq <= 0) continue;
        const key = trimmed.slice(0, eq).trim();
        if (!key || process.env[key]?.trim()) continue;
        let value = trimmed.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[key] = value;
      }
    }
  }

  // Next may hydrate env after our first import — always re-apply before NextAuth reads it.
  normalizeNextAuthUrl();
}

ensureServerEnv();
