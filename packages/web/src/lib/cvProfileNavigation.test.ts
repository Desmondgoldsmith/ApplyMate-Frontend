import { describe, expect, it } from 'vitest';

import { resolveCvProfileId } from '@/lib/api';

describe('resolveCvProfileId', () => {
  it('prefers cvProfileId then profileId then id', () => {
    expect(resolveCvProfileId({ cvProfileId: 'a' })).toBe('a');
    expect(resolveCvProfileId({ profileId: 'b' })).toBe('b');
    expect(resolveCvProfileId({ id: 'c' })).toBe('c');
    expect(
      resolveCvProfileId({ profileId: 'chat' }, { id: 'fallback' }),
    ).toBe('chat');
  });
});
