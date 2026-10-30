'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

import { useTheme } from '@/components/theme/ThemeProvider';
import type {
  ResolvedTheme,
  ThemePreference,
} from '@/lib/theme/themePreference';
import { cn } from '@/lib/utils';

/** A tiny CareerKite screen, rendered in the theme of its nearest `data-theme`. */
function MiniApp() {
  return (
    <div className="flex h-full w-full gap-2 bg-bg-page p-2.5">
      <div className="flex w-[22%] flex-col gap-1.5 rounded-lg border border-border-subtle bg-bg-surface p-1.5">
        <span className="h-2 w-2/3 rounded-full bg-accent-solid" />
        <span className="h-1.5 w-full rounded-full bg-bg-hover" />
        <span className="h-1.5 w-4/5 rounded-full bg-bg-hover" />
        <span className="h-1.5 w-3/5 rounded-full bg-bg-hover" />
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-surface p-2">
          <span className="relative h-7 w-7 shrink-0 rounded-full border-[3px] border-accent-solid" />
          <span className="flex flex-1 flex-col gap-1">
            <span className="h-1.5 w-3/4 rounded-full bg-text-primary opacity-80" />
            <span className="h-1.5 w-1/2 rounded-full bg-text-tertiary opacity-60" />
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-between rounded-lg border border-border-subtle bg-bg-surface p-2">
          <span className="flex flex-col gap-1">
            <span className="h-1.5 w-full rounded-full bg-bg-hover" />
            <span className="h-1.5 w-5/6 rounded-full bg-bg-hover" />
          </span>
          <span className="h-3 w-1/2 self-end rounded-md bg-accent-solid" />
        </div>
      </div>
    </div>
  );
}

function Preview({ theme }: { theme: ResolvedTheme }) {
  return (
    <div data-theme={theme} className="h-full w-full">
      <MiniApp />
    </div>
  );
}

const OPTIONS: { value: ThemePreference; title: string; body: string }[] = [
  {
    value: 'light',
    title: 'Light',
    body: 'Bright and airy, great in daylight.',
  },
  { value: 'dark', title: 'Dark', body: 'Easy on the eyes at night.' },
  {
    value: 'system',
    title: 'Match my device',
    body: 'Switches with your phone or computer.',
  },
];

/** Large theme picker with live previews; choosing applies instantly. */
export function ThemeChoiceCards() {
  const { preference, setPreference } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="grid w-full gap-3 sm:grid-cols-3"
    >
      {OPTIONS.map((option, i) => {
        const selected = preference === option.value;
        return (
          <motion.button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setPreference(option.value)}
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: reducedMotion ? 0 : 0.08 * i,
              duration: 0.35,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={reducedMotion ? undefined : { y: -3 }}
            whileTap={reducedMotion ? undefined : { scale: 0.985 }}
            className={cn(
              'group flex flex-col overflow-hidden rounded-2xl border bg-bg-surface text-left transition-[border-color,box-shadow] duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
              selected
                ? 'border-border-focus shadow-[0_0_0_1px_var(--ck-border-focus),0_0_0_5px_var(--ck-accent-subtle)]'
                : 'border-border-default hover:border-border-strong',
            )}
          >
            <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-border-subtle">
              {option.value === 'system' ? (
                <>
                  <Preview theme="light" />
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: 'polygon(58% 0, 100% 0, 100% 100%, 42% 100%)',
                    }}
                  >
                    <Preview theme="dark" />
                  </div>
                </>
              ) : (
                <Preview theme={option.value} />
              )}
            </div>
            <div className="flex items-start gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-text-primary">
                  {option.title}
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-text-secondary">
                  {option.body}
                </span>
              </span>
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  selected
                    ? 'border-accent-solid bg-accent-solid text-text-on-accent'
                    : 'border-border-strong',
                )}
                aria-hidden
              >
                {selected ? (
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                ) : null}
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
