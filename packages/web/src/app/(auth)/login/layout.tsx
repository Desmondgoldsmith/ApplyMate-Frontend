import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { buildMarketingPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMarketingPageMetadata({
  title: 'Sign in',
  description: 'Sign in to your ApplyMate dashboard to track applications, tailor your CV, and apply smarter.',
  path: '/login',
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
