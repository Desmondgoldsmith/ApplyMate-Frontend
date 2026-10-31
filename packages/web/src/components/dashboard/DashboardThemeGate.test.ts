import { describe, expect, it } from 'vitest';

import { isThemedDashboardRoute } from './DashboardThemeGate';

describe('isThemedDashboardRoute', () => {
  it('follows the theme on Home and the CV pages', () => {
    for (const path of [
      '/dashboard',
      '/dashboard/',
      '/dashboard/cv',
      '/dashboard/cv?profileId=abc',
      '/dashboard/cv-profiles',
    ]) {
      expect(isThemedDashboardRoute(path)).toBe(true);
    }
  });

  it('keeps pages that are not converted yet dark', () => {
    expect(isThemedDashboardRoute('/dashboard/jobs')).toBe(false);
    expect(isThemedDashboardRoute('/dashboard/interview')).toBe(false);
  });
});
