'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';

import { FOLLOW_UP_REASON_COPY, type FollowUpReason } from '@/lib/interview-prep-types';
import { useMotionSafe } from '@/hooks/useMotionSafe';
import { cn } from '@/lib/utils';

export const FollowUpBanner = memo(function FollowUpBanner({
  reason,
  className,
}: {
  reason?: FollowUpReason;
  className?: string;
}) {
  const reduceMotion = useMotionSafe();
  const hint = reason ? FOLLOW_UP_REASON_COPY[reason] : 'Based on your last answer…';

  const inner = (
    <div
      className={cn(
        'rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-200/90">
        Follow-up question
      </p>
      <p className="mt-1 text-xs leading-relaxed text-white/75">{hint}</p>
    </div>
  );

  if (reduceMotion) return inner;
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25 }}
    >
      {inner}
    </motion.div>
  );
});
