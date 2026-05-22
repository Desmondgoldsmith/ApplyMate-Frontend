import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type BentoItemProps = {
  index: number;
  className?: string;
  children: ReactNode;
};

export function BentoItem({ index, className, children }: BentoItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function BentoGrid({ children }: { children: ReactNode }) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-3 auto-rows-fr')}>{children}</div>
  );
}

