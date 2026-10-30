'use client';

import { useId } from 'react';

export const KITE_LIGHT_STOPS = ['#d6ff5e', '#9be22e'] as const;
export const KITE_DARK_STOPS = ['#3ad68a', '#0e9457'] as const;

/** Below this rendered size the string and "you" dot blur, so the compact mark is used. */
const COMPACT_BELOW_PX = 40;

type CareerKiteMarkProps = {
  size?: number;
  /** `full` adds the "you" dot and string; `auto` picks by size. */
  variant?: 'full' | 'compact' | 'auto';
  className?: string;
  /** Accessible name; omit when a visible wordmark sits next to the mark. */
  title?: string;
};

/**
 * The CareerKite mark: a bold C (current text colour) releasing a two-tone
 * kite. The full version adds a dot inside the C (the user) holding the
 * kite's string.
 */
export function CareerKiteMark({
  size = 32,
  variant = 'auto',
  className,
  title,
}: CareerKiteMarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const full =
    variant === 'full' || (variant === 'auto' && size >= COMPACT_BELOW_PX);
  const left = `ck-kite-l-${uid}`;
  const right = `ck-kite-r-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={left} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={KITE_LIGHT_STOPS[0]} />
          <stop offset="1" stopColor={KITE_LIGHT_STOPS[1]} />
        </linearGradient>
        <linearGradient id={right} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={KITE_DARK_STOPS[0]} />
          <stop offset="1" stopColor={KITE_DARK_STOPS[1]} />
        </linearGradient>
      </defs>
      <path
        d="M40 16.5 A 19.5 19.5 0 1 0 45.5 47.5"
        stroke="currentColor"
        strokeWidth="8.5"
        strokeLinecap="round"
      />
      {full ? (
        <>
          <path
            d="M29 33 C 36 31, 41 28, 45.4 28.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle
            cx="28.5"
            cy="33"
            r="4.2"
            style={{ fill: 'var(--ck-mark-dot)' }}
          />
        </>
      ) : null}
      <g transform="rotate(20 51 17)">
        <path d="M51 1 L40.5 12 L51 30 Z" fill={`url(#${left})`} />
        <path d="M51 1 L61.5 12 L51 30 Z" fill={`url(#${right})`} />
      </g>
    </svg>
  );
}
