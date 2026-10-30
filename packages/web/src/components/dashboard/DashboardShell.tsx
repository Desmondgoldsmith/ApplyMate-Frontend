'use client';

import type { ReactNode } from 'react';
import { Suspense, useEffect } from 'react';

import { FunnelPageAnalytics } from '@/components/analytics/FunnelPageAnalytics';
import { BreadcrumbProvider } from '@/components/dashboard/BreadcrumbContext';
import { DashboardMain } from '@/components/dashboard/DashboardMain';
import { Header } from '@/components/dashboard/Header';
import { MobileBottomNav } from '@/components/dashboard/MobileBottomNav';
import { MobileNavToggleFab } from '@/components/dashboard/MobileNavToggleFab';
import { MobileShellProvider } from '@/components/dashboard/MobileShellContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { WalkthroughVideoHost } from '@/components/dashboard/WalkthroughVideoHost';
import { WelcomeTour } from '@/components/dashboard/welcome-tour/WelcomeTour';
import { LocationBootstrap } from '@/components/location/LocationBootstrap';
import { FeatureTour } from '@/components/onboarding/FeatureTour';
import { DashboardOnboardingGate } from '@/components/dashboard/DashboardOnboardingGate';
import { forceAuthSignOut } from '@/lib/authRefresh';
import { useAuthStore } from '@/store/useAuthStore';

export function DashboardShell({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const authSessionReady = useAuthStore((s) => s.authSessionReady);
  /** Session restore finished without a token (expired / revoked): every dashboard request would 401. */
  const signedOut = authSessionReady && !accessToken;

  useEffect(() => {
    if (signedOut) forceAuthSignOut('expired');
  }, [signedOut]);

  if (signedOut) return null;

  return (
    <div className="relative flex h-screen min-h-0 overflow-hidden bg-bg-page text-text-primary">
      <FunnelPageAnalytics surface="dashboard" />
      <DashboardOnboardingGate />
      <Sidebar />
      <BreadcrumbProvider>
        <MobileShellProvider>
          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Header />
            <FeatureTour />
            <Suspense fallback={null}>
              <WelcomeTour />
            </Suspense>
            <WalkthroughVideoHost />
            <LocationBootstrap enabled={Boolean(accessToken)} />
            <Suspense
              fallback={
                <main className="dashboard-app-canvas-bg relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-4">
                  {children}
                </main>
              }
            >
              <DashboardMain>{children}</DashboardMain>
            </Suspense>
            <MobileBottomNav />
            <MobileNavToggleFab />
          </div>
        </MobileShellProvider>
      </BreadcrumbProvider>
    </div>
  );
}
