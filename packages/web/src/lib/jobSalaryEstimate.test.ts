import { describe, expect, it } from 'vitest';

import type { JobSalaryEstimate } from '@/lib/api';
import {
  formatSalaryAmount,
  formatSalaryRange,
  resolveSalaryEstimateSource,
  salaryEstimateSourceLabel,
} from '@/lib/jobSalaryEstimate';

const postingEstimate: JobSalaryEstimate = {
  currency: 'GHS',
  min: 96000,
  max: 144000,
  median: 120000,
  basis: 'annual',
  confidence: 'high',
  note: 'From listing.',
  source: 'job_description',
  sourceLabel: 'From job posting',
  disclaimer: 'Posting disclaimer text.',
};

const aiEstimate: JobSalaryEstimate = {
  currency: 'NGN',
  min: 8_000_000,
  max: 12_000_000,
  median: 10_000_000,
  basis: 'annual',
  confidence: 'low',
  note: 'AI market note.',
  source: 'ai_estimate',
  sourceLabel: 'AI estimate',
  disclaimer: 'AI disclaimer text.',
};

describe('jobSalaryEstimate', () => {
  it('resolves source from source or deprecated dataSource', () => {
    expect(resolveSalaryEstimateSource(postingEstimate)).toBe('job_description');
    expect(
      resolveSalaryEstimateSource({
        ...aiEstimate,
        source: undefined,
        dataSource: 'ai_estimate',
      }),
    ).toBe('ai_estimate');
  });

  it('uses sourceLabel from API', () => {
    expect(salaryEstimateSourceLabel(postingEstimate)).toBe('From job posting');
    expect(salaryEstimateSourceLabel(aiEstimate)).toBe('AI estimate');
  });

  it('formats amounts with Intl and local currency', () => {
    const ghs = formatSalaryAmount(120_000, 'GHS');
    expect(ghs).toMatch(/120/);
    expect(formatSalaryRange(postingEstimate)).toContain('–');
    expect(formatSalaryRange(postingEstimate)).toContain('/ year');
  });
});
