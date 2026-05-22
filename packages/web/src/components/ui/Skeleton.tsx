import { cn } from '@/lib/utils';

type SkeletonProps = {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
};

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 8,
  className,
}: SkeletonProps) {
  return (
    <div
      className={cn('animate-[shimmer_1.5s_ease-in-out_infinite] bg-[length:200%_100%]', className)}
      style={{
        width,
        height,
        borderRadius,
        backgroundImage:
          'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
      }}
    />
  );
}

