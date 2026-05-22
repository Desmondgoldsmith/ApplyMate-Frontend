'use client';

import { cn } from '@/lib/utils';

export function InterviewerThinkingIndicator({
  interviewerName = 'Interviewer',
  message,
  className,
}: {
  interviewerName?: string;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-5 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-2)] px-4 py-2.5',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <span className="flex gap-1" aria-hidden>
        <span className="ip-thinking-dot" />
        <span className="ip-thinking-dot ip-thinking-dot-delay-1" />
        <span className="ip-thinking-dot ip-thinking-dot-delay-2" />
      </span>
      <span className="text-xs text-[var(--text-secondary)]">
        {message ?? `${interviewerName} is reviewing your answer…`}
      </span>
    </div>
  );
}
