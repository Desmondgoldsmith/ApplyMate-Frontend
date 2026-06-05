import { describe, expect, it } from 'vitest';

import { resolveCvProfileId } from '@/lib/api';

describe('CV persist profile id', () => {
  it('reads profileId from chat-create style envelope', () => {
    expect(
      resolveCvProfileId({
        profileId: '11111111-1111-1111-1111-111111111111',
        name: 'My CV',
        isDefault: true,
      }),
    ).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('reads cvProfileId from parse envelope', () => {
    expect(
      resolveCvProfileId({
        cvProfileId: '22222222-2222-2222-2222-222222222222',
        structured: { skills: [] },
      }),
    ).toBe('22222222-2222-2222-2222-222222222222');
  });
});
