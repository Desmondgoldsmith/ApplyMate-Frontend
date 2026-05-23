/** Preload repo-root env before Next.js starts (dev + production). */
const path = require('node:path');
const { loadEnvConfig } = require('@next/env');

const cwd = process.cwd();
const webDir =
  path.basename(cwd) === 'web' && cwd.replace(/\\/g, '/').endsWith('packages/web')
    ? cwd
    : path.join(cwd, 'packages/web');
const repoRoot =
  path.basename(cwd) === 'web' && cwd.replace(/\\/g, '/').endsWith('packages/web')
    ? path.join(cwd, '../..')
    : cwd;
const dev = process.env.NODE_ENV !== 'production';

loadEnvConfig(repoRoot, dev);
loadEnvConfig(webDir, dev);
