'use client';

import { Suspense } from 'react';

import { InterviewSetupStepper } from '@/components/interview/InterviewSetupStepper';

export default function InterviewSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-[360px] animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-[220px] animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      }
    >
      <InterviewSetupStepper />
    </Suspense>
  );
}
