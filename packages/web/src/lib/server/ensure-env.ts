import fs from 'node:fs';
import path from 'node:path';

import { loadEnvConfig } from '@next/env';

declare global {
  var __applymateServerEnvLoaded: boolean | undefined;
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
  if (globalThis.__applymateServerEnvLoaded) return;
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

ensureServerEnv();
