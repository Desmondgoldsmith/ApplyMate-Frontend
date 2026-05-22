import { describe, expect, it } from 'vitest';

import {
  applyUrlAnalyzePayload,
  isValidExternalApplyUrl,
  pickApplyUrlFromRecord,
} from './jobApplyUrlPick';

describe('jobApplyUrlPick', () => {
  it('accepts https employer URLs', () => {
    expect(isValidExternalApplyUrl('https://careers.example.com/jobs/1')).toBe(true);
  });

  it('rejects localhost and in-app paths', () => {
    expect(isValidExternalApplyUrl('http://localhost/jobs/1')).toBe(false);
    expect(isValidExternalApplyUrl('https://applymate.app/dashboard/jobs')).toBe(false);
    expect(isValidExternalApplyUrl('https://example.com/dashboard/jobs')).toBe(false);
  });

  it('picks applyUrl with backend key priority', () => {
    expect(
      pickApplyUrlFromRecord({
        url: 'https://low.example.com',
        applyUrl: 'https://high.example.com',
      }),
    ).toBe('https://high.example.com');
  });

  it('builds analyze payload only for valid URLs', () => {
    expect(applyUrlAnalyzePayload('https://careers.example.com/a')).toEqual({
      applyUrl: 'https://careers.example.com/a',
    });
    expect(applyUrlAnalyzePayload('https://applymate.app/foo')).toEqual({});
  });
});
