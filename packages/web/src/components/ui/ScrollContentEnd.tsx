import { cn } from '@/lib/utils';

/** Trailing spacer so scrollable panels can scroll past the last card (mobile FABs, safe area). */
export function ScrollContentEnd({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none w-full shrink-0', className)}
      style={{
        height: 'max(5rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))',
      }}
    />
  );
}
