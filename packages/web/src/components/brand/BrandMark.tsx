import { cn } from '@/lib/utils';

const BRAND_TEAL = '#00C9B1';

/** ApplyMate logo mark + wordmark. Single source for auth and onboarding chrome. */
export function BrandMark({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(0,201,177,0.12)] ring-1 ring-[rgba(0,201,177,0.35)]"
        aria-hidden
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 3L19 7V17L12 21L5 17V7L12 3Z"
            stroke={BRAND_TEAL}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M12 8V16M8 11L16 15M16 11L8 15"
            stroke={BRAND_TEAL}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {showName ? (
        <span className="text-[15px] font-semibold tracking-tight text-white">
          ApplyMate
        </span>
      ) : null}
    </div>
  );
}
