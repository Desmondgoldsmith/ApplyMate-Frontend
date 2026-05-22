'use client';

import { memo, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Two-column interview layout — isolates structure from orchestration logic. */
export const SessionCore = memo(function SessionCore({
  left,
  right,
  mobileResponseOpen,
}: {
  left: ReactNode;
  right: ReactNode;
  mobileResponseOpen: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-full lg:min-h-0 lg:flex-row">
      <div className="ip-panel-left ip-live-split-left relative flex min-h-0 flex-1 flex-col overflow-hidden border-b border-[var(--border-subtle)] lg:min-h-0 lg:border-b-0 lg:border-r">
        {left}
      </div>
      <div
        className={cn(
          'ip-panel-right ip-live-split-right flex min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden border-t border-[var(--border-subtle)] lg:min-h-0 lg:border-l lg:border-t-0',
          'max-sm:ip-panel-right-sheet',
          mobileResponseOpen && 'max-sm:ip-panel-right-sheet-open',
        )}
      >
        {right}
      </div>
    </div>
  );
});
