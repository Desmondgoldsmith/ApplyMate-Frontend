'use client';

import { TrendingUp } from 'lucide-react';

import { cn } from '@/lib/utils';

import { isRecoveryVisualMode } from '@/components/dashboard/experience-renderer/experienceGrammar';

/** Lightweight assistant-forward momentum strip (optional between major surfaces). */
export function MomentumRenderer({
  line,
  mode,
  fatigueAdjusted,
}: {
  line: string | null;
  mode: string | null;
  fatigueAdjusted: boolean | null;
}) {
  const t = line?.trim();
  if (!t) return null;
  const calm = isRecoveryVisualMode(mode, fatigueAdjusted);

  return (
    <p
      className={cn(
        'flex items-start gap-2 text-[12px] font-medium leading-relaxed text-[#00C9B1]/85',
        calm && 'text-[#9CF5EA]/55',
      )}
    >
      <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{t}</span>
    </p>
  );
}
