'use client';

import { memo } from 'react';

import type { CoachingIntensity, CoachingSettings } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const INTENSITY_OPTIONS: Array<{ id: CoachingIntensity; label: string; hint: string }> = [
  { id: 'light', label: 'Light', hint: 'Score + one tip' },
  { id: 'standard', label: 'Standard', hint: 'Full feedback' },
  { id: 'intensive', label: 'Intensive', hint: 'Examples + follow-ups' },
];

export const CoachingSetupControls = memo(function CoachingSetupControls({
  settings,
  onEnabledChange,
  onIntensityChange,
  disabled,
  className,
}: {
  settings: CoachingSettings;
  onEnabledChange: (enabled: boolean) => void;
  onIntensityChange: (intensity: CoachingIntensity) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] p-4',
        className,
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="sr-only"
          checked={settings.enabled}
          disabled={disabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--border-subtle)]',
            settings.enabled && 'border-[var(--teal-500)] bg-[var(--teal-500)]/20',
          )}
          aria-hidden
        />
        <span>
          <span className="text-sm font-semibold text-[var(--text-primary)]">AI coaching</span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-[var(--text-secondary)]">
            Calm, collapsible feedback after each answer. Turn off anytime during the interview.
          </span>
        </span>
      </label>

      {settings.enabled ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {INTENSITY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={disabled}
              title={opt.hint}
              className={cn(
                'cursor-pointer rounded-full border px-3 py-1 text-[11px] font-semibold transition-all duration-200',
                settings.intensity === opt.id
                  ? 'border-[var(--teal-500)]/50 bg-[var(--teal-500)]/15 text-[var(--text-teal)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--teal-500)]/30',
              )}
              onClick={() => onIntensityChange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
});

export const CoachingStickyToggle = memo(function CoachingStickyToggle({
  settings,
  onToggle,
  disabled,
  className,
}: {
  settings: CoachingSettings;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'ip-coach-sticky-toggle cursor-pointer rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-md transition-all duration-200 active:scale-[0.98]',
        settings.enabled
          ? 'border-[var(--teal-500)]/40 bg-[var(--teal-500)]/15 text-[var(--text-teal)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]',
        className,
      )}
      onClick={onToggle}
      title={settings.enabled ? 'Coaching on — tap to hide' : 'Coaching off — tap to show'}
    >
      Coaching {settings.enabled ? 'on' : 'off'}
      {settings.enabled ? (
        <span className="ml-1.5 text-[10px] font-medium opacity-80">· {settings.intensity}</span>
      ) : null}
    </button>
  );
});
