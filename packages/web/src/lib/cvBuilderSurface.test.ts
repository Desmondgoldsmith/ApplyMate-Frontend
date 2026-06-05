import { describe, expect, it } from 'vitest';

import {
  resolveCvBuilderSurfaceLayout,
  toolbarVisibilityForSurface,
} from '@/lib/cvBuilderSurface';

describe('cvBuilderSurface', () => {
  it('maps onboarding to clinic layout with deferred badges', () => {
    expect(resolveCvBuilderSurfaceLayout('onboarding')).toEqual({
      mode: 'dashboard',
      cvMode: 'clinic',
      deferIncompletePreviewBadges: true,
    });
  });

  it('maps tailoring to tailor layout', () => {
    expect(resolveCvBuilderSurfaceLayout('tailoring').cvMode).toBe('tailor');
  });

  it('hides clinic chrome on onboarding toolbar', () => {
    const v = toolbarVisibilityForSurface('onboarding');
    expect(v.profilePicker).toBe(false);
    expect(v.pdfDocx).toBe(false);
  });

  it('shows full toolbar on clinic', () => {
    const v = toolbarVisibilityForSurface('clinic');
    expect(v.profilePicker).toBe(true);
    expect(v.pdfDocx).toBe(true);
  });
});
