'use client';

import type { ReactNode } from 'react';

type GlowChromeCtaProps = {
  href: string;
  children: ReactNode;
  className?: string;
  /** Navbar / tight spaces — smaller than hero primary CTA */
  size?: 'default' | 'compact';
  onClick?: () => void;
};

export function GlowChromeCta({
  href,
  children,
  className = '',
  size = 'default',
  onClick,
}: GlowChromeCtaProps) {
  const isCompact = size === 'compact';

  const wrapPad = isCompact ? 'p-[1.5px]' : 'p-[2px]';
  const innerClass = isCompact
    ? 'min-h-[42px] gap-2 px-5 py-2.5 text-[12px] font-bold tracking-[0.08em] sm:min-h-[44px] sm:px-6 sm:py-3 sm:text-[13px] [&_svg]:h-4 [&_svg]:w-4'
    : 'min-h-[52px] gap-3 px-9 py-3.5 text-[13px] font-bold tracking-[0.12em] sm:min-h-[56px] sm:px-11 sm:py-4 sm:text-[14px] [&_svg]:h-5 [&_svg]:w-5';

  return (
    <div
      className={`glow-cta-wrap group relative inline-block rounded-full ${wrapPad} transition-[box-shadow] duration-300 ease-out hover:shadow-[0_0_24px_rgba(0,201,177,0.22)] ${className}`}
    >
      <div className="glow-cta-rotating absolute inset-0 rounded-full" aria-hidden />
      <a
        href={href}
        onClick={onClick}
        className={`relative z-[1] flex cursor-pointer items-center justify-center rounded-full border-none bg-[#0C1212] text-white no-underline transition-colors duration-200 group-hover:bg-[#101818] ${innerClass}`}
      >
        {children}
      </a>
    </div>
  );
}
