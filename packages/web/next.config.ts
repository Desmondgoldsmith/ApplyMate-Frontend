import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnvConfig } from '@next/env';
import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

/** Monorepo: load repo-root `.env` / `.env.local`, then package-local overrides. */
const webDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(webDir, '../..');
const dev = process.env.NODE_ENV !== 'production';
loadEnvConfig(repoRoot, dev);
loadEnvConfig(webDir, dev);

import { resolveSentryRelease } from './sentry.shared.config';

const nextConfig: NextConfig = {
  /** Compile the shared workspace package from source (no pre-build step). */
  transpilePackages: ['@applymate/shared'],
};

const sentryRelease = resolveSentryRelease();

export default withSentryConfig(nextConfig, {
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options
  org: process.env.SENTRY_ORG?.trim() || 'mlt-group',
  project: process.env.SENTRY_PROJECT?.trim() || 'javascript-nextjs',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: sentryRelease ? { name: sentryRelease } : undefined,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
