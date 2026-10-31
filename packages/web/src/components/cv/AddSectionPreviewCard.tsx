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
        'group relative min-h-[162px] overflow-hidden rounded-2xl border bg-bg-surface p-3',
        checked
          ? 'border-accent-border shadow-[0_0_0_1px_rgba(23,178,106,0.22)]'
          : 'border-border-subtle',
        !checked && !locked && 'hover:border-accent-border',
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-accent-subtle to-transparent" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-sunken text-accent-text">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">
              {label}
            </p>
            <p className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary">
              {locked ? 'Core section' : 'Optional section'}
            </p>
          </div>
        </div>
        {checked ? (
          <span className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-accent-border bg-accent-subtle px-1.5 py-0 text-[9px] font-semibold leading-none text-accent-text">
            <Check className="h-3 w-3" /> On CV
          </span>
        ) : null}
      </div>

      <div className="relative mt-3 rounded-xl border border-border-subtle bg-black/25 px-2.5 py-2">
        <div className="space-y-1.5">
          <div className="h-1.5 w-24 rounded-full bg-white/20" />
          <div className="h-1.5 w-full rounded-full bg-bg-hover" />
          <div className="h-1.5 w-[78%] rounded-full bg-bg-hover" />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {preview.map((x) => (
            <span
              key={x}
              className="rounded-full border border-border-default bg-bg-surface px-2 py-0.5 text-[10px] text-text-tertiary"
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
