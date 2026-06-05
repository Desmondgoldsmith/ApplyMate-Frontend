import { Suspense } from 'react';

import { JobsAnalyzeContent } from '@/components/jobs/analyze/JobsAnalyzeContent';

export const metadata = { title: 'Analyze Job — ApplyMate' };

export default function JobsAnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[480px] gap-4 lg:grid-cols-[40%_1fr]">
          <div className="h-96 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-96 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      }
    >
      <JobsAnalyzeContent />
    </Suspense>
  );
}
