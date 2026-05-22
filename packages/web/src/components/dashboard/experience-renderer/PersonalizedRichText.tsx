'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Wraps scores, fractions, counts, and percentages so personalized coaching reads with clear numeric emphasis.
 */
export function PersonalizedRichText({
  text,
  className,
  metricClassName,
}: {
  text: string;
  className?: string;
  /** Stronger tabular emphasis for metrics (tone-neutral teal accent). */
  metricClassName?: string;
}) {
  const metric =
    metricClassName ??
    'font-semibold tabular-nums tracking-tight text-[#9CF5EA] [font-variant-numeric:tabular-nums]';

  const nodes = emphasizeMetricSpans(text.trim(), metric);
  if (nodes.length === 0) return null;

  return <span className={cn(className)}>{nodes}</span>;
}

function emphasizeMetricSpans(text: string, metricClass: string): ReactNode[] {
  const re =
    /\d+\/\d+|\d+%|\d+(?=\s+(?:experience\s+)?bullets)|\d+(?=\s+applications\b)|\d+(?=\s+measurable\b)/gi;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <span key={`m-${m.index}-${m[0]}`} className={metricClass}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}
