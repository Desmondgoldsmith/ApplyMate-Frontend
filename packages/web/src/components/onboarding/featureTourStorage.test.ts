import { describe, expect, it, beforeEach } from 'vitest';

import {
  isGlobalTourFinished,
  markGlobalTourCompleted,
  markGlobalTourSkipped,
  resetGlobalTourFlags,
  shouldShowDashboardTour,
  TOUR_COMPLETED_KEY,
  TOUR_SKIPPED_KEY,
} from '@/components/onboarding/featureTourStorage';

describe('featureTourStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows tour only after onboarding and before completion', () => {
    expect(shouldShowDashboardTour({ id: 'u1', onboardingCompleted: false })).toBe(
      false,
    );
    expect(shouldShowDashboardTour({ id: 'u1', onboardingCompleted: true })).toBe(
      true,
    );
    markGlobalTourCompleted('u1');
    expect(shouldShowDashboardTour({ id: 'u1', onboardingCompleted: true })).toBe(
      false,
    );
  });

  it('treats skip flag as finished', () => {
    markGlobalTourSkipped();
    expect(localStorage.getItem(TOUR_SKIPPED_KEY)).toBe('true');
    expect(isGlobalTourFinished({ id: 'u1' })).toBe(true);
  });

  it('migrates legacy dashboard tour keys', () => {
    localStorage.setItem('applymate:tour:dashboard:u1', 'true');
    expect(isGlobalTourFinished({ id: 'u1' })).toBe(true);
  });

  it('reset clears v1 flags', () => {
    markGlobalTourCompleted('u1');
    resetGlobalTourFlags('u1');
    expect(localStorage.getItem(TOUR_COMPLETED_KEY)).toBeNull();
    expect(shouldShowDashboardTour({ id: 'u1', onboardingCompleted: true })).toBe(
      true,
    );
  });
});
