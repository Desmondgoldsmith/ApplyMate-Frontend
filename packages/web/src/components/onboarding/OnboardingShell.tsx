import type { ReactNode } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

import { BrandMark } from '@/components/brand/BrandMark';
import { SkyBackdrop } from '@/components/brand/SkyBackdrop';
import { ForcedThemeScope } from '@/components/theme/ThemeScope';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
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
  /** Pin the whole screen to one theme (the shared CV editor is still dark-only). */
  forcedTheme?: 'dark';
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
    <div className="w-full">
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-bg-hover"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(overall * 100)}
        aria-valuetext={progressHint}
      >
        <motion.div
          className="bg-brand-gradient absolute inset-y-0 left-0 rounded-full"
          initial={false}
          animate={{ width: `${Math.max(4, overall * 100)}%` }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
          }
        />
      </div>
      <ol className="mt-2.5 grid grid-cols-3 text-[12px] font-medium">
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
                  ? 'text-text-primary'
                  : done
                    ? 'text-accent-text'
                    : 'text-text-tertiary',
              )}
              aria-current={current ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold transition-colors duration-300',
                  done
                    ? 'bg-accent-solid text-text-on-accent'
                    : current
                      ? 'border border-text-primary text-text-primary'
                      : 'border border-border-strong text-text-tertiary',
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

export function OnboardingShell({
  step,
  children,
  wide,
  progressHint,
  stepProgress = 0,
  hideProgressChrome,
  fillViewportHeight,
  forcedTheme,
}: OnboardingShellProps) {
  const reducedMotion = useReducedMotion();

  const shell = (
    <div
      className={cn(
        'relative isolate bg-bg-page text-text-primary',
        fillViewportHeight
          ? 'flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden px-4 py-3 sm:px-6 sm:py-4'
          : 'flex min-h-screen flex-col px-5 pb-12 pt-5 sm:px-8 sm:pb-16',
      )}
    >
      {!fillViewportHeight ? (
        <SkyBackdrop className="fixed -z-10 [&_svg]:opacity-50" />
      ) : null}
      {!hideProgressChrome ? (
        <header className="relative z-10 mx-auto grid w-full max-w-[1120px] shrink-0 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-5 sm:grid-cols-[1fr_minmax(0,460px)_1fr]">
          <BrandMark />
          <div className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
            <OnboardingStepper
              step={step}
              stepProgress={stepProgress}
              reducedMotion={reducedMotion}
              progressHint={progressHint}
            />
          </div>
          <ThemeToggle className="justify-self-end sm:col-start-3" />
        </header>
      ) : null}

      <div
        className={cn(
          'relative z-10 mx-auto w-full min-h-0',
          wide ? 'max-w-[min(100%,1320px)]' : 'max-w-[640px]',
          fillViewportHeight
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
            : 'flex flex-1 flex-col justify-center py-10',
        )}
      >
        {children}
      </div>
    </div>
  );

  return forcedTheme ? (
    <ForcedThemeScope theme={forcedTheme}>{shell}</ForcedThemeScope>
  ) : (
    shell
  );
}
