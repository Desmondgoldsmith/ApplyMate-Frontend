import { describe, expect, it } from 'vitest';

import {
  companyInitial,
  pickCompanyLogoUrl,
  readCompanyLogo,
} from './companyLogo';

describe('readCompanyLogo', () => {
  it('prefers companyLogoUrl over legacy aliases', () => {
    expect(
      readCompanyLogo({
        companyLogoUrl: 'https://cdn.example/a.png',
        logoUrl: 'https://cdn.example/b.png',
      }),
    ).toBe('https://cdn.example/a.png');
  });

  it('reads snake_case company_logo_url', () => {
    expect(
      readCompanyLogo({
        company_logo_url: 'https://cdn.example/snake.png',
      }),
    ).toBe('https://cdn.example/snake.png');
  });

  it('falls back to discovery logoUrl on owned-job payloads', () => {
    expect(
      readCompanyLogo({
        logoUrl: 'https://boards.example/logo.png',
      }),
    ).toBe('https://boards.example/logo.png');
  });

  it('returns null for empty strings and missing fields', () => {
    expect(readCompanyLogo({ companyLogoUrl: '' })).toBeNull();
    expect(readCompanyLogo({ companyLogoUrl: '   ' })).toBeNull();
    expect(readCompanyLogo({})).toBeNull();
  });

  it('skips null candidates and uses the next non-empty value', () => {
    expect(
      readCompanyLogo({
        companyLogoUrl: null,
        company_logo_url: null,
        logoUrl: 'https://cdn.example/fallback.png',
      }),
    ).toBe('https://cdn.example/fallback.png');
  });
});

describe('pickCompanyLogoUrl', () => {
  it('normalizes camelCase and snake_case record keys', () => {
    expect(
      pickCompanyLogoUrl({
        company_logo_url: 'https://cdn.example/from-record.png',
      }),
    ).toBe('https://cdn.example/from-record.png');
  });
});

describe('companyInitial', () => {
  it('returns uppercase first letter', () => {
    expect(companyInitial('google')).toBe('G');
  });

  it('returns ? for blank company names', () => {
    expect(companyInitial('')).toBe('?');
    expect(companyInitial('   ')).toBe('?');
  });
});
