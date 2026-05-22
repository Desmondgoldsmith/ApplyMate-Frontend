'use client';

import { memo } from 'react';
import { Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

export const AdaptiveBadge = memo(function AdaptiveBadge({
  className,
  label = 'Adaptive interview active',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[#00C9B1]/35 bg-[#00C9B1]/10 px-2.5 py-1 text-[11px] font-semibold text-[#00C9B1]',
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
});
