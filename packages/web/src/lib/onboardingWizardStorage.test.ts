import { afterEach, describe, expect, it } from 'vitest';

import {
  clearStoredWizard,
  readStoredWizard,
  writeStoredWizard,
  type StoredWizardState,
} from './onboardingWizardStorage';

const state = (userId: string): StoredWizardState => ({
  userId,
  step: 2,
  cvPath: 'chat',
  cvEntryPhase: 'paths',
  buildPhase: 'pick',
  uploadPhase: 'zone',
  selectedTemplate: 'classic',
  selectedFeatures: ['cv'],
});

describe('onboarding wizard storage', () => {
  afterEach(() => clearStoredWizard());

  it('resumes saved progress for the same user', () => {
    writeStoredWizard(state('user-a'));
    expect(readStoredWizard('user-a')).toMatchObject({
      userId: 'user-a',
      step: 2,
      cvPath: 'chat',
      selectedTemplate: 'classic',
    });
  });

  it('never hands one account another account’s progress', () => {
    writeStoredWizard(state('user-a'));
    expect(readStoredWizard('user-b')).toBeNull();
  });

  it('ignores saved progress until the user is known', () => {
    writeStoredWizard(state('user-a'));
    expect(readStoredWizard(null)).toBeNull();
    expect(readStoredWizard(undefined)).toBeNull();
  });

  it('ignores progress saved before it was tagged with a user', () => {
    window.localStorage.setItem(
      'applymate_onboarding_wizard_v1',
      JSON.stringify({ step: 2, cvPath: 'chat' }),
    );
    expect(readStoredWizard('user-a')).toBeNull();
  });
});
