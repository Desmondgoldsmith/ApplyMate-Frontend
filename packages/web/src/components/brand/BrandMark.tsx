import { CareerKiteMark } from '@/components/brand/CareerKiteMark';
import { SITE_NAME } from '@/lib/site';
import { cn } from '@/lib/utils';

/** CareerKite mark + wordmark. Single source for auth and onboarding chrome. */
export function BrandMark({
  className,
  showName = true,
  size = 32,
}: {
  className?: string;
  showName?: boolean;
  size?: number;
}) {
  return (
    <div className={cn('flex items-center gap-2 text-text-primary', className)}>
      <CareerKiteMark size={size} title={showName ? undefined : SITE_NAME} />
      {showName ? (
        <span className="font-display text-[19px] font-bold tracking-[-0.035em]">
          {SITE_NAME}
        </span>
      ) : null}
    </div>
  );
}
