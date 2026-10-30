import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { OnboardingAnalytics } from '@/components/analytics/OnboardingAnalytics';
import { LegacyDarkScope } from '@/components/theme/LegacyDarkScope';
import { buildAppNoIndexMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildAppNoIndexMetadata('Onboarding');

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <LegacyDarkScope>
      <OnboardingAnalytics />
      {children}
    </LegacyDarkScope>
  );
}
