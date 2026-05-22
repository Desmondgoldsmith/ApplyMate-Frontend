'use client';

import { memo } from 'react';

import { formatCategoryLabel } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

export const SkillChipList = memo(function SkillChipList({
  title,
  items,
  variant,
  className,
}: {
  title: string;
  items: string[];
  variant: 'weak' | 'strong';
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-xs font-semibold text-white/55">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium',
              variant === 'weak'
                ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
            )}
          >
            {formatCategoryLabel(item)}
          </span>
        ))}
      </div>
    </div>
  );
});
