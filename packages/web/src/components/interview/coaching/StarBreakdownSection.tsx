'use client';

import { memo } from 'react';

import { CollapsibleCoachingSection } from '@/components/interview/coaching/CollapsibleCoachingSection';
import type { StarBreakdownPart } from '@/lib/interviewCoachingFeedback';
import { cn } from '@/lib/utils';

export const StarBreakdownSection = memo(function StarBreakdownSection({
  parts,
  hintOnly,
  className,
}: {
  parts: StarBreakdownPart[] | null;
  hintOnly: boolean;
  className?: string;
}) {
  if (hintOnly) {
    return (
      <CollapsibleCoachingSection title="STAR breakdown" defaultOpen className={className}>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          Structure your answer with STAR: Situation, Task, Action, and Result — each part should
          say something different.
        </p>
      </CollapsibleCoachingSection>
    );
  }

  if (!parts?.length) return null;

  return (
    <CollapsibleCoachingSection title="STAR breakdown" defaultOpen className={className}>
      <div className="space-y-2">
        {parts.map((part) => (
          <div key={part.key}>
            <p className="text-[10px] font-semibold capitalize text-[var(--text-muted)]">
              {part.key}
            </p>
            <p
              className={cn(
                'text-xs leading-relaxed',
                part.isMissing
                  ? 'italic text-[var(--text-muted)]'
                  : 'text-[var(--text-secondary)]',
              )}
            >
              {part.text}
            </p>
          </div>
        ))}
      </div>
    </CollapsibleCoachingSection>
  );
});
