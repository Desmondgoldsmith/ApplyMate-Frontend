import { describe, expect, it } from 'vitest';

import { cvAssistantBusyMessage } from '@/lib/cvAssistantLoadingCopy';

describe('cvAssistantBusyMessage', () => {
  it('maps stages to user-facing copy', () => {
    expect(cvAssistantBusyMessage('generating')).toMatch(/Generating/i);
    expect(cvAssistantBusyMessage('applying')).toMatch(/Applying/i);
    expect(cvAssistantBusyMessage('validating')).toMatch(/Validating changes/i);
    expect(cvAssistantBusyMessage(null)).toBeNull();
  });
});
