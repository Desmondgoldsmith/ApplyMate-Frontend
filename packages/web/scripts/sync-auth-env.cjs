/**
 * Copy web env from repo-root `.env` → `packages/web/.env.local`.
 *
 * Single source of truth: edit repo-root `.env` only (except NEXT_PUBLIC_EXTENSION_ID
 * which can live in packages/web/.env.local if you prefer).
 */
const fs = require('node:fs');
const path = require('node:path');

/** Synced from root on every `npm run dev`. */
const SYNC_FROM_ROOT = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_USE_NGROK_TUNNEL',
  'NEXT_PUBLIC_EXTENSION_ID',
];

const LOCAL_ONLY_KEYS = ['NEXT_PUBLIC_EXTENSION_ID'];

const NEXTAUTH_API_BASE_PATH = '/api/auth';

function normalizeNextAuthUrl(raw) {
  const value = raw?.trim();
  if (!value) return value;
  try {
    const url = new URL(value.startsWith('http') ? value : `https://${value}`);
    const pathname = url.pathname.replace(/\/$/, '') || '';
    if (pathname === '' || pathname === '/' || pathname === '/api/nextauth') {
      return `${url.origin}${NEXTAUTH_API_BASE_PATH}`;
    }
    return value.trim();
  } catch {
    return value?.trim();
  }
}

function normalizeApiUrl(raw) {
  const value = raw?.trim();
  if (!value) return value;
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/$/, '') || '';
    return pathname === '/api' || pathname === ''
      ? `${url.origin}/api/`
      : value.endsWith('/')
        ? value.trim()
        : `${value.trim()}/`;
  } catch {
    return value?.trim();
  }
}

const webDir = path.join(__dirname, '..');
const repoRoot = path.join(webDir, '../..');
const rootEnvPath = path.join(repoRoot, '.env');
const webLocalPath = path.join(webDir, '.env.local');

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function formatEnvFile(vars, header) {
  const lines = [header, ''];
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined || value === '') continue;
    lines.push(`${key}=${value}`);
  }
  lines.push('');
  return lines.join('\n');
}

const rootVars = parseEnvFile(rootEnvPath);
const existingLocal = parseEnvFile(webLocalPath);

const synced = {};

for (const key of SYNC_FROM_ROOT) {
  const fromRoot = rootVars[key]?.trim();
  if (fromRoot) {
    if (key === 'NEXTAUTH_URL') synced[key] = normalizeNextAuthUrl(fromRoot);
    else if (key === 'NEXT_PUBLIC_API_URL') synced[key] = normalizeApiUrl(fromRoot);
    else synced[key] = fromRoot;
  }
}

for (const key of LOCAL_ONLY_KEYS) {
  if (!synced[key]?.trim() && existingLocal[key]?.trim()) {
    synced[key] = existingLocal[key].trim();
  }
}

const hasAuth =
  synced.GOOGLE_CLIENT_ID?.trim() &&
  synced.GOOGLE_CLIENT_SECRET?.trim() &&
  synced.NEXTAUTH_SECRET?.trim();

if (!hasAuth) {
  console.warn(
    '[sync-auth-env] Missing GOOGLE_* or NEXTAUTH_SECRET in repo root .env — add them and re-run npm run dev.',
  );
  process.exit(0);
}

const header =
  '# Auto-synced from repo root .env (scripts/sync-auth-env.cjs). Edit root .env, not auth keys here.';
const nextContent = formatEnvFile(synced, header);

if (!fs.existsSync(webLocalPath) || fs.readFileSync(webLocalPath, 'utf8') !== nextContent) {
  fs.writeFileSync(webLocalPath, nextContent, 'utf8');
  console.log('[sync-auth-env] Updated packages/web/.env.local from repo root .env');
}
