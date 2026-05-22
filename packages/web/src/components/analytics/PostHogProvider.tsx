'use client';

import { Suspense, useEffect } from 'react';

import { initPostHog, isPostHogEnabled } from '@/lib/posthog';

import { AuthAnalytics } from './AuthAnalytics';
import { PostHogPageView } from './PostHogPageView';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (isPostHogEnabled()) {
      initPostHog();
    }
  }, []);

  return (
    <>
      {children}
      {isPostHogEnabled() ? (
        <>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <AuthAnalytics />
        </>
      ) : null}
    </>
  );
}
