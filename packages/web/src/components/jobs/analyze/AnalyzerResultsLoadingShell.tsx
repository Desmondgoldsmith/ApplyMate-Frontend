'use client';

import { Loader2 } from 'lucide-react';

export function AnalyzerResultsLoadingShell({
  variant,
}: {
  variant: 'empty' | 'overlay';
}) {
  const inner = (
    <>
      <Loader2
        className="mb-4 h-12 w-12 shrink-0 animate-spin text-[#00C9B1]"
        aria-hidden
      />
      <p className="text-lg font-semibold text-white">Running AI analysis…</p>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-white/50">
        We&apos;re scoring your fit, surfacing skill gaps, and drafting
        recruiter context. This usually takes a few seconds.
      </p>
      <div className="mt-10 w-full max-w-md space-y-3">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-white/[0.08]" />
        <div className="h-3 w-full animate-pulse rounded-full bg-white/[0.06]" />
        <div className="h-3 w-5/6 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-8 h-28 w-full animate-pulse rounded-xl bg-white/[0.04]" />
      </div>
    </>
  );

  if (variant === 'overlay') {
    return (
      <div
        className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-[#0a0d0e]/93 px-6 py-10 text-center backdrop-blur-[4px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        {inner}
        <p className="mt-8 max-w-xs text-[11px] leading-relaxed text-white/35">
          Updated scores and gaps will replace this screen automatically.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[480px] flex-col items-center justify-center px-4 py-12 text-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {inner}
    </div>
  );
}
