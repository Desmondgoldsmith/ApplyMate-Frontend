'use client';

import { cn } from '@/lib/utils';

export function NarrativeRenderer({
  arcLabel,
  continuitySentence,
  progressionHint,
  muted,
}: {
  arcLabel: string | null;
  continuitySentence: string | null;
  progressionHint: string | null;
  muted?: boolean;
}) {
  const lines = [arcLabel, continuitySentence, progressionHint].filter(
    (x): x is string => Boolean(x && x.trim()),
  );
  if (lines.length === 0) return null;
  return (
    <div
      className={cn(
        'mt-3 max-w-[560px] space-y-1.5 border-l border-white/[0.12] pl-3',
        muted && 'opacity-90',
      )}
      aria-label="Assistant narrative"
    >
      {lines.map((line, i) => (
        <p key={`${i}-${line.slice(0, 32)}`} className="text-[12px] font-medium leading-relaxed text-white/58">
          {line.trim()}
        </p>
      ))}
    </div>
  );
}
