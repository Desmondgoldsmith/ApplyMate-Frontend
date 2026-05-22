/** CV date storage + display: YYYY, YYYY-MM, legacy MM/YYYY, and named months. */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const MONTH_NAME_MAP: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

export function isYearOnlyValue(raw: string): boolean {
  return /^\d{4}$/.test(raw.trim());
}

export function isMonthYearValue(raw: string): boolean {
  const s = raw.trim();
  return /^\d{4}-\d{2}$/.test(s) || /^(\d{1,2})\/(\d{4})$/.test(s);
}

/** Split stored range text (`2018 - 2020`, `2018 — 2020`) for picker seeds. */
export function splitCvStoredRange(raw: string): { start: string; end: string } {
  const t = raw.trim();
  if (!t) return { start: '', end: '' };
  const m = t.match(/^(.*?)\s+[-–—]\s+(.*)$/);
  if (m?.[1]?.trim() && m[2]?.trim()) {
    return { start: m[1].trim(), end: m[2].trim() };
  }
  return { start: t, end: '' };
}

/** Human-readable label for preview / inputs. */
export function formatCvDateLabel(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  if (/^\d{4}-\d{2}$/.test(s)) {
    const [y, m] = s.split('-');
    const mi = Number(m) - 1;
    return `${MONTH_NAMES[mi] ?? m} ${y}`;
  }

  const legacy = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (legacy) {
    const mm = legacy[1]!.padStart(2, '0');
    const mi = Number(mm) - 1;
    return `${MONTH_NAMES[mi] ?? mm} ${legacy[2]}`;
  }

  if (/^\d{4}$/.test(s)) return s;

  return s;
}

export function formatCvPeriod(start: string, end: string, current: boolean): string {
  const a = formatCvDateLabel(start);
  const b = current ? 'Present' : formatCvDateLabel(end);
  const parts = [a, b].filter(Boolean);
  if (!parts.length) return '';
  return parts.join(' — ');
}

export function formatCvPeriodEnDash(start: string, end: string, current: boolean): string {
  return formatCvPeriod(start, end, current).replace(/\s*—\s*/g, ' – ');
}

export function formatEduRange(startYear: string, endYear: string): string {
  return formatCvPeriod(startYear, endYear, false);
}

export function formatEduRangeStacked(startYear: string, endYear: string): string {
  return formatEduRange(startYear, endYear).replace(/\s*—\s*/g, ' – ');
}

/** Normalize free-typed input into stored form (year or YYYY-MM). */
export function normalizeCvDateInput(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return s;

  const slash = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (slash) return `${slash[2]}-${slash[1]!.padStart(2, '0')}`;

  const namedMonth = s.match(/^([a-zA-Z]+)[,\s]+(\d{4})$/i);
  if (namedMonth) {
    const mon = MONTH_NAME_MAP[namedMonth[1]!.toLowerCase()];
    if (mon) return `${namedMonth[2]}-${mon}`;
  }

  const yearFirst = s.match(/^(\d{4})[,\s]+([a-zA-Z]+)$/i);
  if (yearFirst) {
    const mon = MONTH_NAME_MAP[yearFirst[2]!.toLowerCase()];
    if (mon) return `${yearFirst[1]}-${mon}`;
  }

  const shortMonth = s.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
  if (shortMonth) {
    const mon = MONTH_NAME_MAP[shortMonth[1]!.toLowerCase().slice(0, 3)];
    if (mon) return `${shortMonth[2]}-${mon}`;
  }

  return s;
}

/** Value for native `<input type="month" />` when month precision exists. */
export function toMonthInputValue(raw: string): string {
  const s = normalizeCvDateInput(raw);
  if (!s) return '';
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  if (/^\d{4}$/.test(s)) return `${s}-01`;
  return '';
}

export function parseYearFromCvDate(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}$/.test(s)) return Number(s);
  const ym = s.match(/^(\d{4})-\d{2}$/);
  if (ym) return Number(ym[1]);
  const legacy = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (legacy) return Number(legacy[2]);
  const y = s.match(/(\d{4})/);
  return y ? Number(y[1]) : null;
}

export function parseMonthFromCvDate(raw: string): number | null {
  const s = raw.trim();
  const ym = s.match(/^\d{4}-(\d{2})$/);
  if (ym) return Number(ym[1]);
  const legacy = s.match(/^(\d{1,2})\/\d{4}$/);
  if (legacy) return Number(legacy[1]);
  return null;
}

export function inferPickerGranularity(start: string, end: string): 'year' | 'month' {
  const values = [start, end].filter(Boolean);
  if (values.length === 0) return 'year';
  if (values.every(isYearOnlyValue)) return 'year';
  if (values.some(isMonthYearValue)) return 'month';
  return 'year';
}
