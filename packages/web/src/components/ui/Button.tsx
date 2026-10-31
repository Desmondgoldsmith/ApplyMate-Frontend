import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-accent-solid text-text-on-accent hover:bg-accent-solid-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        ghost:
          'border border-border-default bg-transparent text-text-primary hover:border-accent-border hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        glow: 'bg-accent-solid text-text-on-accent shadow-lg hover:bg-accent-solid-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
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
