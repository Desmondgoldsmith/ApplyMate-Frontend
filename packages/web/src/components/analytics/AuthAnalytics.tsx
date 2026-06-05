'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useRef } from 'react';

import { captureEvent, identifyUser, resetAnalyticsUser } from '@/lib/analytics';
import { useAuthStore } from '@/store/useAuthStore';

/** Keeps PostHog identity and Sentry user context in sync with auth state. */
export function AuthAnalytics() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      identifyUser(user);
      Sentry.setUser({
        id: user.id,
        email: user.email ?? undefined,
      });
      wasAuthenticatedRef.current = true;
      return;
    }
    if (wasAuthenticatedRef.current) {
      captureEvent('auth_logout');
      resetAnalyticsUser();
      Sentry.setUser(null);
      wasAuthenticatedRef.current = false;
    }
  }, [isAuthenticated, user]);

  return null;
}
