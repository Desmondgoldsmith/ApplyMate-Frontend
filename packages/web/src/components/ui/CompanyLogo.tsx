'use client';

import { useState } from 'react';

import { companyInitial } from '@/lib/companyLogo';
import { cn } from '@/lib/utils';

const SIZE_CLASS = {
  sm: 'h-6 w-6 text-[11px]',
  md: 'h-9 w-9 text-[13px]',
  lg: 'h-10 w-10 text-[14px]',
} as const;

export type CompanyLogoProps = {
  company: string;
  logoUrl?: string | null;
  size?: keyof typeof SIZE_CLASS;
  shape?: 'circle' | 'rounded';
  className?: string;
};

export function CompanyLogo({
  company,
  logoUrl,
  size = 'md',
  shape = 'circle',
  className,
}: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);
  const initial = companyInitial(company);
  const src = logoUrl?.trim();
  const shapeClass = shape === 'rounded' ? 'rounded-lg' : 'rounded-full';

  if (!src || failed) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center font-semibold text-[#00C9B1]',
          'bg-[rgba(0,201,177,0.15)]',
          shapeClass,
          SIZE_CLASS[size],
          className,
        )}
        aria-hidden
      >
        {initial}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={cn(
        'shrink-0 border border-white/[0.08] bg-white/[0.04] object-contain',
        shapeClass,
        SIZE_CLASS[size],
        className,
      )}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
