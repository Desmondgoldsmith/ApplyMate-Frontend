'use client';

import { parseYearFromCvDate } from '@/lib/cvDate';
import { cn } from '@/lib/utils';

type CvEntryDateRangePopoverProps = {
  start: string;
  end: string;
  mode?: 'range' | 'single';
  preferYear?: boolean;
  onApply: (start: string, end: string) => void;
  onClose?: () => void;
};

function yearOptions(): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current + 2; y >= current - 60; y -= 1) {
    years.push(y);
  }
  return years;
}

/**
 * Lightweight date range picker for the inline entry toolbar (replaces the heavy calendar grid).
 */
export function CvEntryDateRangePopover({
  start,
  end,
  mode = 'range',
  preferYear = false,
  onApply,
  onClose,
}: CvEntryDateRangePopoverProps) {
  const years = yearOptions();
  const startYear = parseYearFromCvDate(start) ?? new Date().getFullYear();
  const endYear = parseYearFromCvDate(end) ?? new Date().getFullYear();
  const startMonth = /^\d{4}-\d{2}/.test(start.trim()) ? start.trim().slice(0, 7) : '';
  const endMonth = /^\d{4}-\d{2}/.test(end.trim()) ? end.trim().slice(0, 7) : '';

  const finish = (nextStart: string, nextEnd: string) => {
    onApply(nextStart, nextEnd);
    onClose?.();
  };

  return (
    <div className="w-[min(300px,calc(100vw-24px))] rounded-xl border border-white/10 bg-white p-3 shadow-xl">
      <p className="text-[11px] font-semibold text-black/80">
        {mode === 'single' ? 'Date' : 'Date range'}
      </p>
      <p className="mt-0.5 text-[10px] text-black/50">
        {preferYear
          ? 'Pick years, or type dates directly in the entry.'
          : 'Use month pickers, or type like 2018 or Jan 2020 in the entry.'}
      </p>

      <div className="mt-3 space-y-3">
        <label className="block text-[10px] font-medium text-black/65">
          {mode === 'single' ? 'Date' : 'Start'}
          {preferYear ? (
            <select
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs text-black outline-none focus:border-[#00C9B1]"
              value={startYear}
              onChange={(e) => {
                const y = String(e.target.value);
                if (mode === 'single') finish(y, '');
                else finish(y, end);
              }}
            >
              {years.map((y) => (
                <option key={`s-${y}`} value={y}>
                  {y}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="month"
              className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs text-black outline-none focus:border-[#00C9B1] [color-scheme:light]"
              value={startMonth}
              onChange={(e) => {
                const v = e.target.value;
                if (mode === 'single') finish(v, '');
                else finish(v, end);
              }}
            />
          )}
        </label>

        {mode === 'range' ? (
          <label className="block text-[10px] font-medium text-black/65">
            End
            {preferYear ? (
              <select
                className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs text-black outline-none focus:border-[#00C9B1]"
                value={endYear}
                onChange={(e) => finish(start, String(e.target.value))}
              >
                <option value="">Present</option>
                {years.map((y) => (
                  <option key={`e-${y}`} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="month"
                className="mt-1 w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-xs text-black outline-none focus:border-[#00C9B1] [color-scheme:light]"
                value={endMonth}
                onChange={(e) => finish(start, e.target.value)}
              />
            )}
          </label>
        ) : null}
      </div>

      <div className="mt-3 flex justify-end gap-2">
        {mode === 'range' ? (
          <button
            type="button"
            className="rounded-md border border-black/10 px-2.5 py-1 text-[11px] text-black/70 hover:bg-black/5"
            onClick={() => finish(start, '')}
          >
            Present
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            'rounded-md bg-[#00C9B1] px-2.5 py-1 text-[11px] font-semibold text-[#0C0F0F] hover:bg-[#00b39d]',
          )}
          onClick={() => onClose?.()}
        >
          Done
        </button>
      </div>
    </div>
  );
}
