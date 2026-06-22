'use client';

import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const DEFAULT_STEPS = [
  'Uploading your resume…',
  'Scanning your resume…',
  'Checking layout…',
  'Extracting sections…',
  'Scoring your resume…',
  'Almost done…',
] as const;

type CvUploadProgressStepsProps = {
  active?: boolean;
  steps?: readonly string[];
  className?: string;
};

/** Rotating upload/parse status labels for resume creation flows. */
export function CvUploadProgressSteps({
  active = true,
  steps = DEFAULT_STEPS,
  className,
}: CvUploadProgressStepsProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % steps.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [active, steps.length]);

  if (!active) return null;

  return (
    <div className={cn('w-full', className)} role="status" aria-live="polite">
      <ol className="mx-auto max-w-xs space-y-2">
        {steps.map((label, i) => {
          const done = i < index;
          const current = i === index;
          return (
            <li
              key={label}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors',
                current
                  ? 'border-[#00C9B1]/35 bg-[#00C9B1]/8 text-[#7ee8d8]'
                  : done
                    ? 'border-white/[0.08] bg-white/[0.03] text-white/55'
                    : 'border-white/[0.05] bg-transparent text-white/30',
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
              ) : current ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#00C9B1]" aria-hidden />
              ) : (
                <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/15" />
              )}
              <span className="min-w-0 flex-1">{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
