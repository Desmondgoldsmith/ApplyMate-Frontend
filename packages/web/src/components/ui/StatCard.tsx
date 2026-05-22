import type { ReactNode } from 'react';

import { GlowCard } from './GlowCard';
import { Skeleton } from './Skeleton';

type StatCardProps = {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  icon?: ReactNode;
  loading?: boolean;
};

export function StatCard({ label, value, suffix, hint, icon, loading }: StatCardProps) {
  return (
    <GlowCard contentClassName="p-5">
      {loading ? (
        <div className="space-y-3">
          <Skeleton height={14} width="42%" />
          <Skeleton height={30} width="55%" />
          <Skeleton height={12} width="65%" />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.08em] text-white/45">{label}</p>
            {icon}
          </div>
          <p className="text-3xl font-extrabold text-white">
            {value}
            {suffix ? <span className="ml-0.5 text-base text-[#00C9B1]">{suffix}</span> : null}
          </p>
          {hint ? <p className="text-xs text-white/50">{hint}</p> : null}
        </div>
      )}
    </GlowCard>
  );
}

