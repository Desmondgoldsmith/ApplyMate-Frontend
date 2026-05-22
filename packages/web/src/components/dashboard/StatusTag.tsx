'use client';

import { cn } from '@/lib/utils';

export type StatusTagVariant =
  | 'analyzed'
  | 'not_applied'
  | 'applied'
  | 'discovery_fit'
  | 'high_match'
  | 'improvement'
  | 'neutral';

const STYLES: Record<
  StatusTagVariant,
  { bg: string; text: string; border: string }
> = {
  analyzed: {
    bg: 'bg-[rgba(0,201,177,0.1)]',
    text: 'text-[#00C9B1]',
    border: 'border-[rgba(0,201,177,0.3)]',
  },
  not_applied: {
    bg: 'bg-[rgba(245,158,11,0.1)]',
    text: 'text-[#F59E0B]',
    border: 'border-[rgba(245,158,11,0.3)]',
  },
  applied: {
    bg: 'bg-[rgba(16,185,129,0.1)]',
    text: 'text-[#10B981]',
    border: 'border-[rgba(16,185,129,0.3)]',
  },
  discovery_fit: {
    bg: 'bg-[rgba(139,92,246,0.1)]',
    text: 'text-[#A78BFA]',
    border: 'border-[rgba(139,92,246,0.3)]',
  },
  high_match: {
    bg: 'bg-[rgba(0,201,177,0.15)]',
    text: 'text-[#00C9B1] font-semibold',
    border: 'border-[rgba(0,201,177,0.4)]',
  },
  improvement: {
    bg: 'bg-[rgba(245,158,11,0.1)]',
    text: 'text-[#F59E0B]',
    border: 'border-[rgba(245,158,11,0.3)]',
  },
  neutral: {
    bg: 'bg-white/[0.04]',
    text: 'text-white/50',
    border: 'border-white/[0.1]',
  },
};

/** Map backend reason codes / free text to a semantic tag variant. */
export function inferStatusTagVariant(code: string): StatusTagVariant {
  const u = code.toUpperCase().replace(/\s+/g, '_');
  if (u.includes('DISCOVERY') || u.includes('BOARD') || u.includes('LISTING')) return 'discovery_fit';
  if (u.includes('HIGH_MATCH') || u.includes('STRONG_MATCH')) return 'high_match';
  if (u.includes('NOT_APPLIED') || u.includes('NOTAPPLIED') || u.includes('SAVE')) return 'not_applied';
  if (u.includes('APPLIED') || u.includes('TRACKER')) return 'applied';
  if (u.includes('ANALYZ') || u.includes('ANALYSIS')) return 'analyzed';
  if (u.includes('IMPROVE') || u.includes('CV') || u.includes('CLINIC') || u.includes('TAILOR')) return 'improvement';
  return 'neutral';
}

export function formatStatusTagLabel(code: string): string {
  return code
    .replace(/^[A-Z_]+::/i, '')
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase();
}

type StatusTagProps = {
  variant?: StatusTagVariant;
  /** When set, overrides children with formatted label */
  label?: string;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Semantic status pill for dashboard (and reuse elsewhere).
 * 10px uppercase, letter-spacing per dashboard spec.
 */
export function StatusTag({ variant = 'neutral', label, children, className }: StatusTagProps) {
  const s = STYLES[variant];
  const content =
    label != null
      ? formatStatusTagLabel(label)
      : typeof children === 'string'
        ? formatStatusTagLabel(children)
        : children;
  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 items-center truncate rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]',
        s.bg,
        s.text,
        s.border,
        className,
      )}
    >
      {content}
    </span>
  );
}
