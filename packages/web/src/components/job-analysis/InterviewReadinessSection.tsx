'use client';

import { MessageCircle } from 'lucide-react';

import { stripAnalysisUserCopy } from '@/lib/jobAnalysisAts';
import { cn } from '@/lib/utils';

/** Pre-tailor interview prep note from analyze / job detail (`interviewReadinessNote`). */
export function InterviewReadinessSection({
  note,
  className,
}: {
  note: string;
  className?: string;
}) {
  const text = stripAnalysisUserCopy(note);
  if (!text) return null;

  return (
    <section
      className={cn(
        'rounded-2xl border border-[#00C9B1]/18 bg-gradient-to-b from-[#00C9B1]/[0.06] to-transparent p-4 sm:p-5',
        className,
      )}
      aria-labelledby="interview-readiness-heading"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#00C9B1]" aria-hidden />
        <div className="min-w-0">
          <h3
            id="interview-readiness-heading"
            className="text-sm font-semibold text-white"
          >
            Your score &amp; next steps
          </h3>
          <p className="mt-2 text-[13px] leading-relaxed text-white/72">{text}</p>
        </div>
      </div>
    </section>
  );
}
