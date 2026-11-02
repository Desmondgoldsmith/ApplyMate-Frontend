'use client';

import { useSearchParams } from 'next/navigation';

import { JobsAnalyzeContent } from '@/components/jobs/analyze/JobsAnalyzeContent';

import { CheckJobPage } from './CheckJobPage';

/** The browser extension's tailor hand-off still runs on the previous analyzer page. */
export function CheckJobRoute() {
  const searchParams = useSearchParams();
  if (searchParams.get('source') === 'extension') return <JobsAnalyzeContent />;
  return <CheckJobPage />;
}
