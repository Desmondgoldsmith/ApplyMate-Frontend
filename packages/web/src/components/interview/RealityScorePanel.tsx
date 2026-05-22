'use client';

import { memo } from 'react';

import type { RealityScoreBreakdown } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

function Row({ label, value }: { label: string; value?: number }) {
  if (value == null) return null;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
      <span className="text-white/65">{label}</span>
      <span className="font-semibold tabular-nums text-white">{v}</span>
    </li>
  );
}

export const RealityScorePanel = memo(function RealityScorePanel({
  realityScore,
  className,
}: {
  realityScore?: RealityScoreBreakdown | null;
  className?: string;
}) {
  if (!realityScore) return null;

  const overall =
    realityScore.overallRealityScore ??
    averageDefined([
      realityScore.confidenceUnderPressure,
      realityScore.clarityUnderInterruption,
      realityScore.behavioralStrength,
      realityScore.communicationUnderTimePressure,
    ]);

  if (overall == null) return null;

  return (
    <section
      className={cn('rounded-2xl border border-violet-400/25 bg-violet-500/5 p-4 sm:p-5', className)}
      aria-labelledby="reality-score-heading"
    >
      <h3 id="reality-score-heading" className="text-sm font-semibold text-white">
        Interview reality score
      </h3>
      <p className="mt-1 text-3xl font-black text-violet-200">{Math.round(overall)}</p>
      <ul className="mt-4 space-y-2">
        <Row label="Confidence under pressure" value={realityScore.confidenceUnderPressure} />
        <Row label="Clarity under interruption" value={realityScore.clarityUnderInterruption} />
        <Row label="Behavioral strength" value={realityScore.behavioralStrength} />
        <Row label="Communication under time pressure" value={realityScore.communicationUnderTimePressure} />
      </ul>
    </section>
  );
});

function averageDefined(values: Array<number | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
