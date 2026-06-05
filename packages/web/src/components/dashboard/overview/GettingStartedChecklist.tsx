'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import { sectionMotion } from '@/components/dashboard/overview/dashboardOverviewHelpers';

export function GettingStartedChecklist({
  hasCvProfile,
  anyProfileScored,
  totalJobsAnalyzed,
}: {
  hasCvProfile: boolean;
  anyProfileScored: boolean;
  totalJobsAnalyzed: number;
}) {
  const items: Array<{ label: string; done: boolean }> = [
    { label: 'Create your account', done: true },
    { label: 'Build or upload a CV', done: hasCvProfile },
    { label: 'Score your CV', done: anyProfileScored },
    { label: 'Analyze your first job', done: totalJobsAnalyzed > 0 },
  ];

  return (
    <motion.section
      {...sectionMotion}
      transition={{
        duration: 0.35,
        delay: 0.35,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      data-tour="getting-started"
      className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6"
    >
      <p className="mb-4 text-[15px] font-semibold text-white/90">
        Get the most out of ApplyMate
      </p>
      <div className="flex flex-row flex-wrap gap-x-6 gap-y-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex min-w-[140px] items-center gap-2"
          >
            {item.done ? (
              <Check
                className="h-4 w-4 shrink-0 text-[#00C9B1]"
                strokeWidth={2.5}
              />
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border border-white/25" />
            )}
            <span
              className={
                item.done
                  ? 'text-[13px] font-medium text-white'
                  : 'text-[13px] font-medium text-white/25'
              }
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
