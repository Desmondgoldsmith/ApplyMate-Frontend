'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { AnimatedBorderCard } from '@/components/landing/AnimatedBorderCard';

type GlowCardProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function GlowCard({ children, className, contentClassName }: GlowCardProps) {
  return (
    <AnimatedBorderCard
      className={cn(
        'min-w-0 max-w-full w-full overflow-x-hidden transition-shadow duration-300 ease-out hover:shadow-[0_12px_40px_rgba(0,201,177,0.08)]',
        className,
      )}
      contentClassName={cn('min-w-0 max-w-full overflow-x-hidden rounded-[20px] bg-[#0C0F0F]', contentClassName)}
      radiusPx={20}
      rotateDuration={6}
    >
      {children}
    </AnimatedBorderCard>
  );
}

