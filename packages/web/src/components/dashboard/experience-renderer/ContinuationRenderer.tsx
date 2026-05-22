'use client';

import { motion } from 'framer-motion';

import { ExecutionWorkspaceCard } from '@/components/dashboard/ExecutionWorkspaceCard';
import type { DashboardContinuationView } from '@/lib/dashboardViewModel';

import { continuationMemoryMicrocopy, continuationResumeCtaClass } from '@/components/dashboard/experience-renderer/experienceGrammar';

export function ContinuationRenderer({
  continuation,
  onClick,
  reducedMotion,
}: {
  continuation: DashboardContinuationView;
  onClick?: () => void;
  reducedMotion?: boolean;
}) {
  const microcopy = continuationMemoryMicrocopy(continuation.interruptionAgeHours);
  const resumeCtaClassName = continuationResumeCtaClass(continuation.resumeConfidence);

  return (
    <motion.div
      layout={false}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <ExecutionWorkspaceCard
        continuation={continuation}
        memoryMicrocopy={microcopy}
        resumeCtaClassName={resumeCtaClassName}
        onClick={onClick}
      />
    </motion.div>
  );
}
