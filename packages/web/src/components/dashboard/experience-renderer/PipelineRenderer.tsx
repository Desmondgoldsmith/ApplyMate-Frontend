'use client';

import { motion } from 'framer-motion';

import { DashboardPipelineSnapshotCard } from '@/components/dashboard/DashboardPipelineSnapshotCard';
import type { PipelineMetricView } from '@/lib/dashboardViewModel';
import { cn } from '@/lib/utils';

import { isRecoveryVisualMode } from '@/components/dashboard/experience-renderer/experienceGrammar';

export function PipelineRenderer({
  metrics,
  headline,
  body,
  forceRender,
  titleOverride,
  emptyStateCopyOverride,
  sectionEyebrow,
  primaryLineFallback,
  disableOuterMotion,
  mode,
  fatigueAdjusted,
  reducedMotion,
}: {
  metrics: PipelineMetricView[];
  headline: string | null;
  body: string | null;
  forceRender?: boolean;
  titleOverride?: string | null;
  emptyStateCopyOverride?: string | null;
  sectionEyebrow?: string | null;
  primaryLineFallback?: string | null;
  /** When nested inside another animated wrapper, skip duplicate motion. */
  disableOuterMotion?: boolean;
  mode: string | null;
  fatigueAdjusted: boolean | null;
  reducedMotion?: boolean;
}) {
  const calm = isRecoveryVisualMode(mode, fatigueAdjusted);

  const inner = (
    <DashboardPipelineSnapshotCard
      metrics={metrics}
      headline={headline}
      body={body}
      forceRender={forceRender}
      titleOverride={titleOverride}
      emptyStateCopyOverride={emptyStateCopyOverride}
      sectionEyebrow={sectionEyebrow}
      primaryLineFallback={primaryLineFallback}
    />
  );

  if (disableOuterMotion) {
    return <div className={cn(calm && 'opacity-[0.92]')}>{inner}</div>;
  }

  return (
    <motion.div
      layout={false}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 0.61, 0.36, 1] }}
      className={cn(calm && 'opacity-[0.92]')}
    >
      {inner}
    </motion.div>
  );
}
