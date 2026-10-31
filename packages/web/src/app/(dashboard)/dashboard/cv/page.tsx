'use client';

import { Suspense } from 'react';

import { CvClinicPageContent } from '@/components/cv/clinic/CvClinicPageContent';

function CvClinicPageFallback() {
  return (
    <div className="space-y-2.5">
      <div className="h-6 w-36 rounded bg-bg-hover" />
      <div className="h-24 rounded bg-bg-hover" />
      <div className="h-[420px] rounded bg-bg-hover" />
    </div>
  );
}

/** CV Clinic — layout shell; editor chrome and panels live in `CvClinicPageContent`. */
export default function CVPage() {
  return (
    <Suspense fallback={<CvClinicPageFallback />}>
      <CvClinicPageContent />
    </Suspense>
  );
}
