import { describe, expect, it } from 'vitest';

import { labelForAiUsageFlow } from '@/lib/aiUsageFlowLabels';

describe('aiUsageFlowLabels', () => {
  it('maps CV_CHAT separately from CV_PARSE', () => {
    expect(labelForAiUsageFlow('CV_CHAT')).toBe('CV builder chat');
    expect(labelForAiUsageFlow('CV_PARSE')).toBe('CV file or text extraction');
  });

  it('maps CV_CHAT_STRUCTURED_EXTRACT', () => {
    expect(labelForAiUsageFlow('CV_CHAT_STRUCTURED_EXTRACT')).toBe('Chat — structured CV from pasted text');
  });

  it('falls back for unknown flows', () => {
    expect(labelForAiUsageFlow('NEW_FLOW_X')).toBe('NEW FLOW X');
    expect(labelForAiUsageFlow('')).toBe('AI action');
  });
});
