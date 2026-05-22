'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useEffect, useLayoutEffect, useState } from 'react';

import { PostHogProvider } from '@/components/analytics/PostHogProvider';
import { ForceDarkTheme } from '@/components/theme/ForceDarkTheme';
import { SmoothScrollProvider } from '@/components/smooth-scroll-provider';
import { ToastViewport } from '@/components/ui/Toast';
import { subscribeAuthLogout } from '@/lib/authSync';
import { shouldRetryFailedQuery } from '@/lib/axios';
import { useAuthStore } from '@/store/useAuthStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  useLayoutEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    return subscribeAuthLogout(() => {
      useAuthStore.getState().clearAuth({ skipBroadcast: true });
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        window.location.href = '/login';
      }
    });
  }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            /** Avoid retry storms on 401/403/429 (backend auth throttle + session expiry). */
            retry: shouldRetryFailedQuery,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <QueryClientProvider client={queryClient}>
        <PostHogProvider>
          <ForceDarkTheme />
          <SmoothScrollProvider>
            {children}
            <ToastViewport />
          </SmoothScrollProvider>
        </PostHogProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
