'use client';

import { GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';

import { GlowCard } from '@/components/ui/GlowCard';

export default function StudentGuidePage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-2xl font-extrabold text-white">Student Career Guide</h2>
        <p className="text-sm text-white/50">Step-by-step path from your first CV to your first offer.</p>
      </div>
      <GlowCard contentClassName="flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
        <GraduationCap className="mb-4 h-16 w-16 text-[#00C9B1]" />
        <p className="text-lg font-semibold text-white">Coming soon</p>
        <p className="mt-2 max-w-md text-sm text-white/45">
          We&apos;re building guided lessons and milestones tailored to students and career switchers.
        </p>
      </GlowCard>
    </motion.div>
  );
}
