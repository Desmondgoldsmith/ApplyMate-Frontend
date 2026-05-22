import { Suspense } from 'react';

import { JobHub } from './JobHub';

export const metadata = { title: 'Job Hub — ApplyMate' };

export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-14 min-w-[720px] animate-pulse rounded-lg bg-white/[0.04]" />
          <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      }
    >
      <JobHub />
    </Suspense>
  );
}
