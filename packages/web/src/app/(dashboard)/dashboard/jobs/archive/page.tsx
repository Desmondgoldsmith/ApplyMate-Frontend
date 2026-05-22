import { Suspense } from 'react';

import { JobsArchiveContent } from './JobsArchiveContent';

export const metadata = { title: 'Archived jobs — ApplyMate' };

export default function JobsArchivePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4" aria-busy="true">
          <div className="lg:hidden space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
            ))}
          </div>
          <div className="hidden lg:block space-y-2">
            <div className="h-10 w-64 animate-pulse rounded-lg bg-white/[0.06]" />
            <div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />
          </div>
        </div>
      }
    >
      <JobsArchiveContent />
    </Suspense>
  );
}
