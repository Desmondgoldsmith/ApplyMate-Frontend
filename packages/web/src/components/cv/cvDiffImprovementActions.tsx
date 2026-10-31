'use client';

import { createContext, useContext } from 'react';

/** When true, CV improvement diff Accept/Reject controls ignore clicks (parent has a request in flight). */
export const CvDiffActionsBusyContext = createContext(false);

export function CvDiffActionPair({
  className,
  acceptLabel,
  rejectLabel,
  onAccept,
  onReject,
}: {
  className?: string;
  acceptLabel: string;
  rejectLabel: string;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const busy = useContext(CvDiffActionsBusyContext);
  const rejectCls =
    'rounded-md border border-danger-border bg-white px-2.5 py-1 text-[10px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:pointer-events-none disabled:opacity-40';
  const acceptCls =
    'rounded-md border border-success-border bg-success-subtle px-2.5 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-success-subtle disabled:pointer-events-none disabled:opacity-40';
  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        className={rejectCls}
        onClick={() => !busy && onReject?.()}
      >
        {rejectLabel}
      </button>
      <button
        type="button"
        disabled={busy}
        className={acceptCls}
        onClick={() => !busy && onAccept?.()}
      >
        {acceptLabel}
      </button>
    </div>
  );
}
