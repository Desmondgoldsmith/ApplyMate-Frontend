'use client';

import type { ReactNode } from 'react';
import { Check, type LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

export type AddSectionPreviewCardProps = {
  label: string;
  icon: LucideIcon;
  checked: boolean;
  locked?: boolean;
  preview: string[];
  footer?: ReactNode;
  customBody?: ReactNode;
};

/** Stable card shell for Add Section modal — must live outside the modal component to avoid input remounts. */
export function AddSectionPreviewCard({
  label,
  icon: Icon,
  checked,
  locked = false,
  preview,
  footer,
  customBody,
}: AddSectionPreviewCardProps) {
  return (
    <div
      className={cn(
        'group relative min-h-[162px] overflow-hidden rounded-2xl border bg-[#0B0F10]/90 p-3',
        checked ? 'border-[#00C9B1]/55 shadow-[0_0_0_1px_rgba(0,201,177,0.22)]' : 'border-white/[0.08]',
        !checked && !locked && 'hover:border-[#00C9B1]/45',
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#00C9B1]/10 to-transparent" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 text-[#2DD4BF]">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{label}</p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
              {locked ? 'Core section' : 'Optional section'}
            </p>
          </div>
        </div>
        {checked ? (
          <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-[#00C9B1]/45 bg-[#00C9B1]/12 px-1.5 py-0 text-[9px] font-semibold leading-none text-[#44E6D6]">
            <Check className="h-3 w-3" /> On CV
          </span>
        ) : null}
      </div>

      <div className="relative mt-3 rounded-xl border border-white/[0.08] bg-black/25 px-2.5 py-2">
        <div className="space-y-1.5">
          <div className="h-1.5 w-24 rounded-full bg-white/20" />
          <div className="h-1.5 w-full rounded-full bg-white/10" />
          <div className="h-1.5 w-[78%] rounded-full bg-white/10" />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {preview.map((x) => (
            <span
              key={x}
              className="rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/55"
            >
              {x}
            </span>
          ))}
        </div>
      </div>

      <div className="relative mt-3">{customBody ?? footer}</div>
    </div>
  );
}
