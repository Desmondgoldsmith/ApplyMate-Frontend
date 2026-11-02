import { Suspense } from 'react';

import { CheckJobRoute } from '@/components/jobs/check/CheckJobRoute';

export const metadata = { title: 'Check a job · CareerKite' };

export default function JobsAnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto h-96 w-full max-w-[820px] animate-pulse rounded-3xl bg-bg-surface" />
      }
    >
      <CheckJobRoute />
    </Suspense>
  );
}
