import type { ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

import { BrandMark } from '@/components/brand/BrandMark';
import { cn } from '@/lib/utils';

const STEP_LABELS = ['About you', 'Your CV', "You're ready"] as const;

type OnboardingShellProps = {
  step: 1 | 2 | 3;
  children: ReactNode;
  /** Wider layout for CV upload / builder (step 2). */
  wide?: boolean;
  /** Screen-reader description of the current position (e.g. “Part 1 of 3 · About you”). */
  progressHint?: string;
  /** 0–1 progress inside the current part, so the bar moves on every screen. */
  stepProgress?: number;
  /** Hides progress chrome so the editor can sit flush at the top (e.g. manual resume clinic). */
  hideProgressChrome?: boolean;
  /** Flex column layout so children can use flex-1 min-h-0 for nested scroll panes. */
  fillViewportHeight?: boolean;
};

function OnboardingStepper({
  step,
  stepProgress,
  reducedMotion,
  progressHint,
}: {
  step: 1 | 2 | 3;
  stepProgress: number;
  reducedMotion: boolean | null;
  progressHint?: string;
}) {
  const within = Math.min(1, Math.max(0, stepProgress));
  const overall = Math.min(1, (step - 1 + (step === 3 ? 1 : within)) / 3);
  return (
    <div className="w-full max-w-[520px]">
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(overall * 100)}
        aria-valuetext={progressHint}
      >
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#00C9B1] to-[#5EEAD4] shadow-[0_0_12px_rgba(0,201,177,0.6)]"
          initial={false}
          animate={{ width: `${Math.max(4, overall * 100)}%` }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
          }
        />
      </div>
      <ol className="mt-3 grid grid-cols-3 text-[11px] font-medium sm:text-[12px]">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = step > n;
          const current = step === n;
          return (
            <li
              key={label}
              className={cn(
                'flex items-center gap-1.5',
                i === 1 && 'justify-center',
                i === 2 && 'justify-end',
                current
                  ? 'text-white'
                  : done
                    ? 'text-[#7EE8D8]'
                    : 'text-white/35',
              )}
              aria-current={current ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-colors duration-300',
                  done
                    ? 'bg-[#00C9B1] text-[#080A0A]'
                    : current
                      ? 'bg-white text-[#080A0A]'
                      : 'bg-white/10 text-white/50',
                )}
                aria-hidden
              >
                {done ? <Check className="h-2.5 w-2.5" strokeWidth={4} /> : n}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function AmbientBackdrop({ reducedMotion }: { reducedMotion: boolean | null }) {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-0 overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="absolute -left-[15%] -top-[20%] h-[55vmax] w-[55vmax] rounded-full bg-[radial-gradient(closest-side,rgba(0,201,177,0.14),transparent)] blur-2xl"
        animate={reducedMotion ? undefined : { x: [0, 40, 0], y: [0, 30, 0] }}
        transition={
          reducedMotion
            ? undefined
            : { duration: 22, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      <motion.div
        className="absolute -bottom-[25%] -right-[10%] h-[50vmax] w-[50vmax] rounded-full bg-[radial-gradient(closest-side,rgba(94,234,212,0.08),transparent)] blur-2xl"
        animate={reducedMotion ? undefined : { x: [0, -30, 0], y: [0, -40, 0] }}
        transition={
          reducedMotion
            ? undefined
            : { duration: 26, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
    </div>
  );
}

export function OnboardingShell({
  step,
  children,
  wide,
  progressHint,
  stepProgress = 0,
  hideProgressChrome,
  fillViewportHeight,
}: OnboardingShellProps) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'relative isolate bg-[#0A0A0A] text-white',
        fillViewportHeight
          ? 'flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden px-6 py-4 sm:px-6 sm:py-5'
          : 'flex min-h-screen flex-col px-5 pb-12 pt-7 sm:px-6 sm:pb-16 sm:pt-9',
      )}
    >
      {!fillViewportHeight ? (
        <AmbientBackdrop reducedMotion={reducedMotion} />
      ) : null}
      {!hideProgressChrome ? (
        <header className="relative z-10 flex shrink-0 flex-col items-center">
          <BrandMark className="mb-6" />
          <OnboardingStepper
            step={step}
            stepProgress={stepProgress}
            reducedMotion={reducedMotion}
            progressHint={progressHint}
          />
        </header>
      ) : null}

      <div
        className={cn(
          'relative z-10 mx-auto w-full min-h-0',
          wide ? 'max-w-[min(100%,1320px)]' : 'max-w-[600px]',
          fillViewportHeight
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
            : 'flex flex-1 flex-col justify-center py-8',
        )}
      >
        {children}
      </div>
    </div>
  );
}
