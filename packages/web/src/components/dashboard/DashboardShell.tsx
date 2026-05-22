'use client';

import type { ReactNode } from 'react';

import { FunnelPageAnalytics } from '@/components/analytics/FunnelPageAnalytics';
import { BreadcrumbProvider } from '@/components/dashboard/BreadcrumbContext';
import { DashboardMain } from '@/components/dashboard/DashboardMain';
import { Header } from '@/components/dashboard/Header';
import { MobileBottomNav } from '@/components/dashboard/MobileBottomNav';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { AppShellBackdrop } from '@/components/layout/AppShellBackdrop';
import { LocationBootstrap } from '@/components/location/LocationBootstrap';
import { FeatureTour } from '@/components/onboarding/FeatureTour';
import { useAuthStore } from '@/store/useAuthStore';

export function DashboardShell({ children }: { children: ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  return (
    <div className="relative flex h-screen min-h-0 overflow-hidden bg-transparent">
      <FunnelPageAnalytics surface="dashboard" />
      <AppShellBackdrop />
      <Sidebar />
      <BreadcrumbProvider>
        <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Header />
          <FeatureTour />
          <LocationBootstrap enabled={Boolean(accessToken)} />
          <DashboardMain>{children}</DashboardMain>
          <MobileBottomNav />
        </div>
      </BreadcrumbProvider>
    </div>
  );
}
