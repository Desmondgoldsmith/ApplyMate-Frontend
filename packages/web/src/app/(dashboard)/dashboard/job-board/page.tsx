import { Suspense } from 'react';

import JobBoardContent from './JobBoardContent';

export const metadata = { title: 'Job Board - ApplyMate' };

export default function JobBoardPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[480px] gap-4 lg:grid-cols-[40%_1fr]">
          <div className="h-96 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-96 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      }
    >
      <JobBoardContent />
    </Suspense>
  );
}
