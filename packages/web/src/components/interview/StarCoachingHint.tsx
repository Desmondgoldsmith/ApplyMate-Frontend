'use client';

import { memo } from 'react';
import { Lightbulb } from 'lucide-react';

import type { StarFeedback, StarMissingPart } from '@/lib/interview-prep-types';
import { cn } from '@/lib/utils';

const PART_LABELS: Record<StarMissingPart, string> = {
  situation: 'Situation',
  task: 'Task',
  action: 'Action',
  result: 'Result',
};

export const StarCoachingHint = memo(function StarCoachingHint({
  feedback,
  className,
}: {
  feedback: StarFeedback | null | undefined;
  className?: string;
}) {
  if (!feedback?.suggestionText?.trim() && !(feedback?.missingParts?.length)) return null;

  return (
    <aside
      className={cn(
        'rounded-xl border border-[#00C9B1]/20 bg-[#00C9B1]/5 px-3 py-2.5',
        className,
      )}
      aria-label="STAR coaching hint"
    >
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#00C9B1]" aria-hidden />
        <div className="min-w-0 flex-1">
          {feedback.missingParts?.length ? (
            <p className="text-[11px] font-semibold text-white/55">
              Missing:{' '}
              {feedback.missingParts.map((p) => PART_LABELS[p] ?? p).join(', ')}
            </p>
          ) : null}
          {feedback.suggestionText ? (
            <p className="mt-0.5 text-xs leading-relaxed text-white/75">{feedback.suggestionText}</p>
          ) : null}
          {feedback.improvedHint ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{feedback.improvedHint}</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
});
