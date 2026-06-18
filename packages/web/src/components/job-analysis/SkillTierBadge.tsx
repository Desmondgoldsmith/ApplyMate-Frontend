'use client';

import type { SkillRequirementTier } from '@/lib/skillCoverage';
import { skillTierLabel } from '@/lib/skillCoverage';
import { cn } from '@/lib/utils';

export function SkillTierBadge({
  tier,
  className,
}: {
  tier?: SkillRequirementTier;
  className?: string;
}) {
  const label = skillTierLabel(tier);
  if (!label) return null;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        tier === 'required'
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-200/90'
          : tier === 'preferred'
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-100/90'
            : 'border-white/12 bg-white/[0.04] text-white/40',
        className,
      )}
    >
      {label}
    </span>
  );
}
