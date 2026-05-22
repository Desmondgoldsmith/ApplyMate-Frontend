'use client';

import { memo, type ReactNode } from 'react';

type CvTripleShellPreviewColumnProps = {
  centerHeaderActions?: ReactNode;
  previewFrame: ReactNode;
};

export const CvTripleShellPreviewColumn = memo(function CvTripleShellPreviewColumn({
  centerHeaderActions,
  previewFrame,
}: CvTripleShellPreviewColumnProps) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080B0B]">
      {centerHeaderActions ? (
        <div className="flex shrink-0 items-center justify-end border-b border-white/[0.06] px-3 py-2">
          <div className="flex items-center gap-2">{centerHeaderActions}</div>
        </div>
      ) : null}
      <div
        data-lenis-prevent-wheel
        className="app-scrollbar flex min-h-0 flex-1 justify-center overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] touch-pan-y overscroll-y-contain px-0 pt-2 pb-4"
      >
        <div className="w-full min-w-0 max-w-full shrink-0">{previewFrame}</div>
      </div>
    </div>
  );
});
