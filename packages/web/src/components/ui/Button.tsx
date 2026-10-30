import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]',
        ghost:
          'border border-white/15 bg-white/[0.02] text-white hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/10',
        glow: 'bg-[#00C9B1] text-[#080A0A] shadow-[0_0_24px_rgba(0,201,177,0.35)] hover:shadow-[0_0_30px_rgba(0,201,177,0.5)]',
        /** Theme-aware primary (CareerKite lime). */
        accent:
          'h-12 rounded-xl bg-accent-solid text-[15px] text-text-on-accent shadow-[inset_0_-2px_0_rgb(0_0_0/0.08)] hover:bg-accent-solid-hover active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        /** Theme-aware secondary on surfaces. */
        outline:
          'h-12 rounded-xl border border-border-default bg-bg-surface text-[15px] text-text-primary hover:border-border-strong hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      fullWidth: false,
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ className, variant, fullWidth, asChild, ...props }, ref) {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, fullWidth }), className)}
        {...props}
      />
    );
  },
);
