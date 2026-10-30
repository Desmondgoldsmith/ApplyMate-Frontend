'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';

import { useTheme } from '@/components/theme/ThemeProvider';
import type { ThemePreference } from '@/lib/theme/themePreference';
import { cn } from '@/lib/utils';

const OPTIONS: { value: ThemePreference; label: string; Icon: LucideIcon }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'Match device', Icon: Monitor },
];

/** Compact three-way theme switch (icons only; names via tooltip + aria-label). */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border-subtle bg-bg-surface p-1 shadow-raised',
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
              selected
                ? 'bg-accent-solid text-text-on-accent'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
