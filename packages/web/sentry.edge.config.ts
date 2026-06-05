// This file configures the initialization of Sentry for edge features.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

import { buildSentryInitOptions } from './sentry.shared.config';

Sentry.init(buildSentryInitOptions());
