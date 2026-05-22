'use client';

import { memo } from 'react';
import { Mic } from 'lucide-react';

import { cn } from '@/lib/utils';

export type SimulationCardMode = 'hr_simulation' | 'senior_interviewer_simulation';

const COPY: Record<
  SimulationCardMode,
  { title: string; subtitle: string; difficulty: 'Medium' | 'Hard'; stressHint: string }
> = {
  hr_simulation: {
    title: 'HR interview',
    subtitle: 'Screening-style questions, calm tone.',
    difficulty: 'Medium',
    stressHint: 'Good for first-round practice',
  },
  senior_interviewer_simulation: {
    title: 'Hiring manager interview',
    subtitle: 'Senior scrutiny, direct follow-ups.',
    difficulty: 'Hard',
    stressHint: 'Best when you want realistic pressure',
  },
};

export const SimulationModeCard = memo(function SimulationModeCard({
  mode,
  selected,
  stressLevel,
  onSelect,
  onStressChange,
}: {
  mode: SimulationCardMode;
  selected: boolean;
  stressLevel: number;
  onSelect: () => void;
  onStressChange: (level: number) => void;
}) {
  const meta = COPY[mode];

  return (
    <article
      className={cn('ip-sim-card relative', selected && 'ip-sim-card-active')}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <span
          className={cn(
            'absolute right-4 top-4',
            meta.difficulty === 'Medium' ? 'ip-badge-medium' : 'ip-badge-hard',
          )}
        >
          {meta.difficulty}
        </span>

        <span className="ip-mic-circle" aria-hidden>
          <Mic className="h-5 w-5" />
        </span>

        <h3 className="mt-3 text-[15px] font-semibold text-[var(--text-primary)]">{meta.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">{meta.subtitle}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{meta.stressHint}</p>

        <span className="mt-4 inline-block text-xs font-medium text-[var(--text-teal)]">
          Start simulation →
        </span>
      </button>

      {selected ? (
        <label className="mt-4 block border-t border-[var(--border-subtle)] pt-4">
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Stress level: {stressLevel}/5
          </span>
          <input
            type="range"
            min={1}
            max={5}
            value={stressLevel}
            onChange={(e) => onStressChange(Number(e.target.value))}
            className="ip-slider mt-2"
            onClick={(e) => e.stopPropagation()}
          />
        </label>
      ) : null}
    </article>
  );
});
