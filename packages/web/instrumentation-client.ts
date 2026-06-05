// This file configures the initialization of Sentry on the client.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

import { buildSentryInitOptions } from './sentry.shared.config';

Sentry.init(
  buildSentryInitOptions({
    integrations: [Sentry.replayIntegration()],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  }),
);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
