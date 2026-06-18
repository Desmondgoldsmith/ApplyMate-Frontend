'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { PostHogProvider } from '@/components/analytics/PostHogProvider';
import { ExtensionAuthBridge } from '@/components/extension/ExtensionAuthBridge';
import { ForceDarkTheme } from '@/components/theme/ForceDarkTheme';
import { SmoothScrollProvider } from '@/components/smooth-scroll-provider';
import { ToastViewport } from '@/components/ui/Toast';
import {
  setupAuthRefreshInterceptor,
  startAuthTokenRefreshScheduler,
  tryRestoreSessionFromApiCookie,
} from '@/lib/authRefresh';
import { isPublicAuthPath, subscribeAuthLogout } from '@/lib/authSync';
import { axiosClient, shouldRetryFailedQuery } from '@/lib/axios';
import { NEXTAUTH_API_BASE_PATH } from '@/lib/nextauth-api';
import { useAuthStore } from '@/store/useAuthStore';

export function Providers({ children }: { children: React.ReactNode }) {
  const refreshInterceptorReady = useRef(false);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  useLayoutEffect(() => {
    hydrateFromStorage();
    if (!refreshInterceptorReady.current) {
      setupAuthRefreshInterceptor(axiosClient);
      refreshInterceptorReady.current = true;
    }
  }, [hydrateFromStorage]);

  useEffect(() => {
    const setReady = useAuthStore.getState().setAuthSessionReady;
    if (isPublicAuthPath()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      await tryRestoreSessionFromApiCookie();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeAuthLogout(() => {
      useAuthStore.getState().clearAuth({ skipBroadcast: true });
      const path = window.location.pathname;
      if (!path.startsWith('/login') && !path.startsWith('/register')) {
        window.location.href = '/login';
      }
    });
  }, []);

  useEffect(() => startAuthTokenRefreshScheduler(), []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            /** Avoid retry storms on 401/403/429/502 and dead backend (ECONNRESET). */
            retry: shouldRetryFailedQuery,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
            refetchOnWindowFocus: true,
          },
        },
      }),
  );

  return (
    <SessionProvider
      basePath={NEXTAUTH_API_BASE_PATH}
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      <QueryClientProvider client={queryClient}>
        <PostHogProvider>
          <ForceDarkTheme />
          <ExtensionAuthBridge />
          <SmoothScrollProvider>
            {children}
            <ToastViewport />
          </SmoothScrollProvider>
        </PostHogProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
