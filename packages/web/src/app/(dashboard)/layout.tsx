import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { LegacyDarkScope } from '@/components/theme/LegacyDarkScope';
import { buildAppNoIndexMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildAppNoIndexMetadata('Dashboard');

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <LegacyDarkScope>
      <DashboardShell>{children}</DashboardShell>
    </LegacyDarkScope>
  );
}
