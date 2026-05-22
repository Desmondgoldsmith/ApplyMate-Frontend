import type { ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { cn } from '@/lib/utils';

const BRAND_TEAL = '#00C9B1';

type OnboardingShellProps = {
  step: 1 | 2 | 3;
  children: ReactNode;
  /** Wider layout for CV upload / builder (step 2). */
  wide?: boolean;
  /** Line under the progress bar (e.g. “Part 1 of 3 · Your goals”). */
  progressHint?: string;
  /** Hides progress chrome so the editor can sit flush at the top (e.g. manual resume clinic). */
  hideProgressChrome?: boolean;
  /** Flex column layout so children can use flex-1 min-h-0 for nested scroll panes. */
  fillViewportHeight?: boolean;
};

function SegmentedProgressBar({ step, reducedMotion }: { step: 1 | 2 | 3; reducedMotion: boolean | null }) {
  const duration = reducedMotion ? 0 : 0.4;
  return (
    <div className="flex w-full gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3}>
      {([1, 2, 3] as const).map((n) => {
        const completed = step > n;
        const active = step === n;
        const bg = completed ? 'rgba(0,201,177,0.5)' : active ? BRAND_TEAL : 'rgba(255,255,255,0.15)';
        return (
          <motion.div
            key={n}
            className="h-1.5 min-h-[6px] flex-1 rounded-full"
            initial={false}
            animate={{ backgroundColor: bg }}
            transition={{ duration, ease: 'easeInOut' }}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

function ApplyMateMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2', className)}>
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(0,201,177,0.12)] ring-1 ring-[rgba(0,201,177,0.35)]"
        aria-hidden
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 3L19 7V17L12 21L5 17V7L12 3Z"
            stroke={BRAND_TEAL}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M12 8V16M8 11L16 15M16 11L8 15" stroke={BRAND_TEAL} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-white">ApplyMate</span>
    </div>
  );
}

export function OnboardingShell({
  step,
  children,
  wide,
  progressHint,
  hideProgressChrome,
  fillViewportHeight,
}: OnboardingShellProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'bg-[#0A0A0A] text-white',
        fillViewportHeight
          ? 'flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden px-6 py-4 sm:px-6 sm:py-5'
          : 'flex min-h-screen flex-col px-6 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10',
      )}
    >
      {!hideProgressChrome ? (
        <header className="flex shrink-0 flex-col items-center">
          <ApplyMateMark className="mb-6" />
          <div className="w-[calc(100%-48px)] max-w-[480px]">
            <SegmentedProgressBar step={step} reducedMotion={reducedMotion} />
          </div>
          {progressHint ? (
            <p
              className="mt-2 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-[rgba(255,255,255,0.45)]"
              style={{ letterSpacing: '0.12em' }}
            >
              {progressHint}
            </p>
          ) : null}
        </header>
      ) : null}

      <div
        className={cn(
          'mx-auto w-full min-h-0',
          wide ? 'max-w-[min(100%,1320px)]' : 'max-w-[560px]',
          fillViewportHeight ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'flex flex-1 flex-col justify-center',
        )}
      >
        {children}
      </div>
    </div>
  );
}
