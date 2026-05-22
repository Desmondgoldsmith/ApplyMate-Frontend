import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Follow-up queue — ApplyMate',
  description: 'Prioritized roles that need a follow-up—open each from here.',
};

export default function FollowUpJobsLayout({ children }: { children: ReactNode }) {
  return children;
}
