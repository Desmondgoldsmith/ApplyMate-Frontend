import { cn } from '@/lib/utils';

/** Soft lime/emerald glows plus thin drifting "wind" strokes. Fills its positioned parent. */
export function SkyBackdrop({
  className,
  wind = true,
}: {
  className?: string;
  wind?: boolean;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        className,
      )}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 50% at 78% 18%, var(--ck-glow-a), transparent 70%), radial-gradient(55% 45% at 10% 92%, var(--ck-glow-b), transparent 70%)',
        }}
      />
      {wind ? (
        <svg
          className="absolute inset-0 h-full w-full text-text-tertiary"
          viewBox="0 0 600 800"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            className="ck-wind-line"
            d="M-40 210 C 120 170, 260 250, 640 160"
          />
          <path
            className="ck-wind-line ck-wind-line-slow"
            d="M-40 330 C 160 300, 340 380, 640 290"
          />
          <path
            className="ck-wind-line"
            d="M-40 520 C 140 480, 300 560, 640 470"
          />
        </svg>
      ) : null}
    </div>
  );
}
