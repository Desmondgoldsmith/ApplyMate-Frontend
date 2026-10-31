'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  inferPickerGranularity,
  parseMonthFromCvDate,
  parseYearFromCvDate,
} from '@/lib/cvDate';

type DateRangePickerProps = {
  start: string;
  end: string;
  onApply: (start: string, end: string) => void;
  onClose?: () => void;
  mode?: 'range' | 'single';
  /** Default tab when opening — education often uses year-only */
  defaultGranularity?: 'year' | 'month';
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function yearWindowAnchor(...years: Array<number | null>): number {
  const valid = years.filter(
    (y): y is number => y != null && Number.isFinite(y),
  );
  if (valid.length > 0) return Math.max(...valid) - 3;
  return new Date().getFullYear() - 3;
}

export function DateRangePicker({
  start,
  end,
  onApply,
  onClose,
  mode = 'range',
  defaultGranularity,
}: DateRangePickerProps) {
  const [tab, setTab] = useState<'from' | 'to'>('from');
  const [granularity, setGranularity] = useState<'year' | 'month'>(
    () => defaultGranularity ?? inferPickerGranularity(start, end),
  );
  const [draftStart, setDraftStart] = useState(start);
  const [draftEnd, setDraftEnd] = useState(end);

  const startYear = parseYearFromCvDate(draftStart);
  const endYear = parseYearFromCvDate(draftEnd);
  const startMonth = parseMonthFromCvDate(draftStart);

  const [yearWindowStart, setYearWindowStart] = useState(() =>
    yearWindowAnchor(startYear, endYear),
  );
  const [pickYear, setPickYear] = useState(
    startYear ?? new Date().getFullYear(),
  );
  const [pickMonth, setPickMonth] = useState(startMonth ?? 1);

  useEffect(() => {
    setDraftStart(start);
    setDraftEnd(end);
    setGranularity(defaultGranularity ?? inferPickerGranularity(start, end));
    const sy = parseYearFromCvDate(start);
    const ey = parseYearFromCvDate(end);
    setYearWindowStart(yearWindowAnchor(sy, ey));
    setPickYear(sy ?? ey ?? new Date().getFullYear());
    setPickMonth(parseMonthFromCvDate(start) ?? 1);
    setTab('from');
  }, [start, end, defaultGranularity]);

  const years = useMemo(
    () => Array.from({ length: 12 }, (_, i) => yearWindowStart + i),
    [yearWindowStart],
  );

  const commit = (nextStart: string, nextEnd: string) => {
    onApply(nextStart, nextEnd);
    onClose?.();
  };

  const applyYear = (year: number) => {
    const y = String(year);
    if (mode === 'single') {
      setDraftStart(y);
      setDraftEnd('');
      commit(y, '');
      return;
    }
    if (tab === 'from') {
      setDraftStart(y);
      setDraftEnd('');
      setTab('to');
      setPickYear(parseYearFromCvDate(draftEnd) ?? year);
      return;
    }
    setDraftEnd(y);
    commit(draftStart, y);
  };

  const applyMonth = (year: number, month: number) => {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    if (mode === 'single') {
      setDraftStart(ym);
      setDraftEnd('');
      commit(ym, '');
      return;
    }
    if (tab === 'from') {
      setDraftStart(ym);
      setTab('to');
      setPickYear(parseYearFromCvDate(draftEnd) ?? year);
      setPickMonth(parseMonthFromCvDate(draftEnd) ?? month);
      return;
    }
    setDraftEnd(ym);
    commit(draftStart, ym);
  };

  const preview =
    mode === 'single'
      ? draftStart || '—'
      : [draftStart, draftEnd].filter(Boolean).join(' – ') || '—';

  return (
    <div className="w-[min(320px,calc(100vw-24px))] rounded-xl border border-border-subtle bg-bg-surface p-3 shadow-2xl">
      <div className="mb-2 flex rounded-lg bg-bg-surface p-0.5">
        <button
          type="button"
          className={`flex-1 rounded-md py-1.5 text-xs font-medium ${granularity === 'year' ? 'bg-accent-subtle text-accent-text' : 'text-text-tertiary'}`}
          onClick={() => setGranularity('year')}
        >
          Year
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md py-1.5 text-xs font-medium ${granularity === 'month' ? 'bg-accent-subtle text-accent-text' : 'text-text-tertiary'}`}
          onClick={() => setGranularity('month')}
        >
          Month
        </button>
      </div>

      {mode === 'range' ? (
        <div className="mb-2 flex rounded-lg bg-bg-surface p-1">
          <button
            type="button"
            className={`flex-1 rounded-md py-1 text-sm ${tab === 'from' ? 'bg-accent-subtle text-accent-text' : 'text-text-tertiary'}`}
            onClick={() => {
              setTab('from');
              setPickYear(startYear ?? new Date().getFullYear());
              setPickMonth(startMonth ?? 1);
            }}
          >
            From
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md py-1 text-sm ${tab === 'to' ? 'bg-accent-subtle text-accent-text' : 'text-text-tertiary'}`}
            onClick={() => {
              setTab('to');
              setPickYear(endYear ?? startYear ?? new Date().getFullYear());
              setPickMonth(parseMonthFromCvDate(draftEnd) ?? 12);
            }}
          >
            To
          </button>
        </div>
      ) : (
        <div className="mb-2 rounded-lg bg-bg-surface p-1 text-center text-sm text-accent-text">
          Date
        </div>
      )}

      <p className="mb-2 text-center text-[11px] text-text-tertiary">
        {mode === 'range' && tab === 'to'
          ? 'Select end'
          : mode === 'range'
            ? 'Select start'
            : 'Select date'}
        {' · '}
        <span className="text-text-secondary">{preview}</span>
      </p>

      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setYearWindowStart((y) => y - 12)}
          className="rounded p-1 text-text-secondary hover:bg-bg-hover"
          aria-label="Earlier years"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Years
        </span>
        <button
          type="button"
          onClick={() => setYearWindowStart((y) => y + 12)}
          className="rounded p-1 text-text-secondary hover:bg-bg-hover"
          aria-label="Later years"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6">
        {years.map((y) => {
          const active =
            (tab === 'from' &&
              draftStart &&
              parseYearFromCvDate(draftStart) === y) ||
            (tab === 'to' && draftEnd && parseYearFromCvDate(draftEnd) === y) ||
            pickYear === y;
          return (
            <button
              key={y}
              type="button"
              onClick={() => {
                setPickYear(y);
                if (granularity === 'year') applyYear(y);
              }}
              className={`rounded-lg border px-1 py-1.5 text-sm transition ${
                active
                  ? 'border-accent-border bg-accent-subtle text-accent-text'
                  : 'border-border-subtle text-text-secondary hover:border-accent-border'
              }`}
            >
              {y}
            </button>
          );
        })}
      </div>

      {granularity === 'month' ? (
        <>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
            Month · {pickYear}
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS.map((m, idx) => (
              <button
                key={m}
                type="button"
                onClick={() => applyMonth(pickYear, idx + 1)}
                className="rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-accent-subtle hover:text-accent-text"
              >
                {m}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-center text-[10px] leading-relaxed text-text-tertiary">
          {mode === 'range'
            ? 'Pick a start year, then a end year (e.g. 2018 → 2020).'
            : 'Pick a year, or switch to Month for Jan 2020 style dates.'}
        </p>
      )}

      <div className="mt-3 flex gap-2 border-t border-border-subtle pt-3">
        <button
          type="button"
          className="flex-1 rounded-lg border border-border-default py-2 text-xs text-text-tertiary hover:bg-bg-surface"
          onClick={() => {
            setDraftStart('');
            setDraftEnd('');
            commit('', '');
          }}
        >
          Clear
        </button>
        {mode === 'range' &&
        granularity === 'year' &&
        tab === 'to' &&
        draftStart &&
        !draftEnd ? (
          <button
            type="button"
            className="flex-1 rounded-lg bg-accent-solid py-2 text-xs font-semibold text-text-on-accent"
            onClick={() => commit(draftStart, draftEnd)}
          >
            Done
          </button>
        ) : mode === 'range' && draftStart && draftEnd ? (
          <button
            type="button"
            className="flex-1 rounded-lg bg-accent-subtle py-2 text-xs font-semibold text-accent-text"
            onClick={() => commit(draftStart, draftEnd)}
          >
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}
