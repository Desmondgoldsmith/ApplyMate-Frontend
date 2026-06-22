'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';

import { FunnelPageAnalytics } from '@/components/analytics/FunnelPageAnalytics';
import { BreadcrumbProvider } from '@/components/dashboard/BreadcrumbContext';
import { DashboardMain } from '@/components/dashboard/DashboardMain';
import { Header } from '@/components/dashboard/Header';
import { MobileBottomNav } from '@/components/dashboard/MobileBottomNav';
import { MobileNavToggleFab } from '@/components/dashboard/MobileNavToggleFab';
import { MobileShellProvider } from '@/components/dashboard/MobileShellContext';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { AppShellBackdrop } from '@/components/layout/AppShellBackdrop';
import { LocationBootstrap } from '@/components/location/LocationBootstrap';
import { FeatureTour } from '@/components/onboarding/FeatureTour';
import { DashboardOnboardingGate } from '@/components/dashboard/DashboardOnboardingGate';
import { useAuthStore } from '@/store/useAuthStore';

export function DashboardShell({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return (
    <div className="relative flex h-screen min-h-0 overflow-hidden bg-transparent">
      <FunnelPageAnalytics surface="dashboard" />
      <DashboardOnboardingGate />
      <AppShellBackdrop />
      <Sidebar />
      <BreadcrumbProvider>
        <MobileShellProvider>
          <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Header />
            <FeatureTour />
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
