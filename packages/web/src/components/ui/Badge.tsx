import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      variant: {
        teal: 'border-[#00C9B1]/30 bg-[#00C9B1]/10 text-[#9be8e8]',
        amber: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
        red: 'border-red-400/30 bg-red-500/10 text-red-300',
        muted: 'border-white/15 bg-white/[0.04] text-white/65',
      },
    },
    defaultVariants: {
      variant: 'muted',
    },
  },
);

type BadgeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

