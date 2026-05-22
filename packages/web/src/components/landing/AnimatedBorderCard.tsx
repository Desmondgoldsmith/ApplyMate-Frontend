'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type AnimatedBorderCardProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Outer corner radius in px (inner is radius - 1 for the 1px “border”). */
  radiusPx?: number;
  rotateDuration?: number;
};

export function AnimatedBorderCard({
  children,
  className = '',
  contentClassName = '',
  radiusPx = 20,
  rotateDuration = 6,
}: AnimatedBorderCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
      el.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  const outerStyle: CSSProperties = {
    borderRadius: radiusPx,
    ['--rotate-duration' as string]: `${rotateDuration}s`,
  };

  const innerStyle: CSSProperties = {
    borderRadius: Math.max(0, radiusPx - 1),
  };

  return (
    <div
      ref={ref}
      className={`animated-border-card min-h-0 min-w-0 max-w-full ${className}`}
      style={outerStyle}
    >
      <div className="animated-border-rotating" aria-hidden />
      <div className="animated-border-mouse-glow" aria-hidden />
      <div
        className={cn('card-content flex min-h-0 min-w-0 max-w-full flex-col overflow-x-hidden', contentClassName)}
        style={innerStyle}
      >
        {children}
      </div>
    </div>
  );
}
