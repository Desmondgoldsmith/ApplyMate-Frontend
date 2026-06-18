'use client';

import type { RequirementKind } from '@/lib/skillCoverage';
import { requirementKindLabel } from '@/lib/skillCoverage';
import { cn } from '@/lib/utils';

export function RequirementKindBadge({
  kind,
  className,
}: {
  kind?: RequirementKind;
  className?: string;
}) {
  const label = requirementKindLabel(kind);
  if (!label) return null;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        kind === 'tool'
          ? 'border-sky-500/30 bg-sky-500/10 text-sky-200/90'
          : 'border-violet-500/30 bg-violet-500/10 text-violet-200/90',
        className,
      )}
    >
      {label}
    </span>
  );
}
