'use client';

import { memo } from 'react';

import { cn } from '@/lib/utils';

export const InterviewNetworkNotice = memo(function InterviewNetworkNotice({
  message,
  visible,
  className,
}: {
  message: string | null;
  visible: boolean;
  className?: string;
}) {
  if (!visible || !message?.trim()) return null;

  return (
    <div
      className={cn(
        'shrink-0 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs text-amber-100/95',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
});
