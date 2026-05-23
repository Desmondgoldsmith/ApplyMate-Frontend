/**
 * Copy Google/NextAuth vars from repo-root `.env` into `packages/web/.env.local`
 * so Next.js Turbopack exposes them in route handlers.
 */
const fs = require('node:fs');
const path = require('node:path');

const AUTH_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
];

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

const synced = { ...existingLocal };
let changed = false;

for (const key of AUTH_KEYS) {
  const fromRoot = rootVars[key]?.trim();
  if (!fromRoot) continue;
  if (synced[key] !== fromRoot) {
    synced[key] = fromRoot;
    changed = true;
  }
}

if (!AUTH_KEYS.some((k) => synced[k]?.trim())) {
  console.warn(
    '[sync-auth-env] No GOOGLE_* / NEXTAUTH_* in repo root .env — add them and re-run npm run dev.',
  );
  process.exit(0);
}

const header =
  '# Auto-synced from repo root .env (scripts/sync-auth-env.cjs). Do not leave empty overrides here.';
const nextContent = formatEnvFile(synced, header);

if (!fs.existsSync(webLocalPath) || fs.readFileSync(webLocalPath, 'utf8') !== nextContent) {
  fs.writeFileSync(webLocalPath, nextContent, 'utf8');
  changed = true;
}

if (changed) {
  console.log('[sync-auth-env] Updated packages/web/.env.local from repo root .env');
}
