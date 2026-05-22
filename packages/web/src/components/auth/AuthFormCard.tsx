'use client';

import type { ReactNode } from 'react';

import { AnimatedBorderCard } from '@/components/landing/AnimatedBorderCard';
import { cn } from '@/lib/utils';

type AuthFormCardProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Same language as landing “Install & Import” cards: animated border + teal radial accents + gradient fill.
 */
export function AuthFormCard({ children, className, contentClassName }: AuthFormCardProps) {
  return (
    <AnimatedBorderCard
      className={cn('transition-all duration-300 ease-out hover:-translate-y-0.5', className)}
      contentClassName={cn('relative overflow-hidden rounded-[20px] p-0', contentClassName)}
      radiusPx={20}
      rotateDuration={6}
    >
      <div
        className="pointer-events-none absolute -right-[72px] -top-[72px] h-[200px] w-[200px] rounded-full opacity-[0.11]"
        style={{
          background: 'radial-gradient(circle, #00C9B1 0%, transparent 68%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-[56px] -left-[48px] h-[190px] w-[190px] rounded-full opacity-[0.07]"
        style={{
          background: 'radial-gradient(circle, rgba(0,212,212,0.55) 0%, transparent 72%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          background:
            'linear-gradient(145deg, rgba(0,201,177,0.06) 0%, transparent 42%, rgba(0,201,177,0.03) 100%)',
        }}
        aria-hidden
      />
      <div
        className={cn(
          'relative z-[1] rounded-[19px] bg-gradient-to-br from-[#101818] via-[#0a1010] to-[#060a0a] p-6',
        )}
      >
        {children}
      </div>
    </AnimatedBorderCard>
  );
}
