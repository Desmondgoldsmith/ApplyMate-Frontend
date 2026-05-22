'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export type ListPaginationProps = {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function ListPagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
  className,
}: ListPaginationProps) {
  if (total <= 0) return null;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-[12px] text-white/45 tabular-nums">
        Showing {rangeStart}–{rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="h-9 gap-1 border border-white/12 px-3 text-[12px] text-white/70"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        <span className="min-w-[4.5rem] text-center text-[12px] font-medium tabular-nums text-white/55">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="ghost"
          className="h-9 gap-1 border border-white/12 px-3 text-[12px] text-white/70"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
