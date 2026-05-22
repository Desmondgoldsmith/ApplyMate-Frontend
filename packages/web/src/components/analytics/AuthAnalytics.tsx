'use client';

import { useEffect, useRef } from 'react';

import { captureEvent, identifyUser, resetAnalyticsUser } from '@/lib/analytics';
import { useAuthStore } from '@/store/useAuthStore';

/** Keeps PostHog identity in sync with auth state. */
export function AuthAnalytics() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wasAuthenticatedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      identifyUser(user);
      wasAuthenticatedRef.current = true;
      return;
    }
    if (wasAuthenticatedRef.current) {
      captureEvent('auth_logout');
      resetAnalyticsUser();
      wasAuthenticatedRef.current = false;
    }
  }, [isAuthenticated, user]);

  return null;
}
