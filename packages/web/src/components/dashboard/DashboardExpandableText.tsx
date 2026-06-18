'use client';

import { useState } from 'react';

import { cn } from '@/lib/utils';

type Props = {
  text: string;
  maxChars?: number;
  className?: string;
};

/** Full text with optional "Show more" when longer than maxChars. */
export function DashboardExpandableText({
  text,
  maxChars = 120,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = text.trim();
  if (!trimmed) return null;

  const needsToggle = trimmed.length > maxChars;
  const display =
    needsToggle && !expanded ? `${trimmed.slice(0, maxChars).trimEnd()}…` : trimmed;

  return (
    <div className="min-w-0">
      <p className={cn('text-[12px] font-medium leading-snug', className)}>{display}</p>
      {needsToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-left text-[12px] font-medium text-[#00C9B1] hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}
