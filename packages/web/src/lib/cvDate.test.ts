import { describe, expect, it } from 'vitest';

import {
  formatCvDateLabel,
  formatCvPeriod,
  normalizeCvDateInput,
  splitCvStoredRange,
} from './cvDate';

describe('cvDate', () => {
  it('formats year-only values', () => {
    expect(formatCvDateLabel('2018')).toBe('2018');
    expect(formatCvPeriod('2018', '2020', false)).toBe('2018 — 2020');
  });

  it('formats month-year values', () => {
    expect(formatCvDateLabel('2018-06')).toBe('Jun 2018');
  });

  it('normalizes typed years and months', () => {
    expect(normalizeCvDateInput('2020')).toBe('2020');
    expect(normalizeCvDateInput('Jan 2019')).toBe('2019-01');
  });

  it('splits stored range strings for picker seeds', () => {
    expect(splitCvStoredRange('2018 - 2020')).toEqual({ start: '2018', end: '2020' });
    expect(splitCvStoredRange('2018-06')).toEqual({ start: '2018-06', end: '' });
  });
});
