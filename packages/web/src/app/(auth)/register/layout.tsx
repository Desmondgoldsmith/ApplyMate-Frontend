import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { buildMarketingPageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMarketingPageMetadata({
  title: 'Create account',
  description:
    'Create your free ApplyMate account. Score your CV against roles, tailor applications, and manage your job search in one place.',
  path: '/register',
});

export default function RegisterLayout({ children }: { children: ReactNode }) {
  return children;
}
