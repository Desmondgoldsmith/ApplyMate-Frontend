'use client';

import {
  CvDiffActionPair,
  CvDiffActionsBusyContext,
} from '@/components/cv/cvDiffImprovementActions';
import { assistantChangedFieldLabel } from '@/lib/cvAssistantDiffDisplay';
import { cn } from '@/lib/utils';

type CvDiffMobileActionBarProps = {
  visible: boolean;
  sectionId: string | null | undefined;
  disabled?: boolean;
  onAccept: () => void;
  onReject: () => void;
  className?: string;
};

/** Sticky accept/reject when AI diff is active — mainly for narrow layouts where preview is below the fold. */
export function CvDiffMobileActionBar({
  visible,
  sectionId,
  disabled = false,
  onAccept,
  onReject,
  className,
}: CvDiffMobileActionBarProps) {
  if (!visible || !sectionId?.trim()) return null;

  const label = assistantChangedFieldLabel(sectionId);

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[84] flex justify-center px-3 lg:hidden',
        className,
      )}
      style={{
        bottom: 'max(5.5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))',
      }}
      role="region"
      aria-label="Review AI suggestion"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-emerald-500/35 bg-[#0C1010]/98 p-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-400/90">
          AI suggestion ready
        </p>
        <p className="mt-0.5 text-[13px] font-medium text-white/90">
          Review changes to your {label}
        </p>
        <p className="mt-1 text-[11px] leading-snug text-white/45">
          Accept to apply, or reject to keep your current text. You can also
          review in the preview above.
        </p>
        <CvDiffActionsBusyContext.Provider value={disabled}>
          <CvDiffActionPair
            className="mt-3 flex items-center justify-end gap-2"
            acceptLabel="✓ Accept"
            rejectLabel="✕ Reject"
            onAccept={onAccept}
            onReject={onReject}
          />
        </CvDiffActionsBusyContext.Provider>
      </div>
    </div>
  );
}
