import { describe, expect, it } from 'vitest';

import { CV_CHAT_INPUT_MAX_CHARS } from '@/lib/cv-chat-input.constants';
import {
  cvChatInputLimitErrorMessage,
  formatCvChatCharCount,
  isCvChatInputOverLimit,
} from '@/lib/cvChatInputDisplay';

describe('cvChatInputDisplay', () => {
  it('uses 100k max aligned with backend', () => {
    expect(CV_CHAT_INPUT_MAX_CHARS).toBe(100_000);
  });

  it('formatCvChatCharCount shows cap when near limit', () => {
    expect(formatCvChatCharCount(90_000)).toContain('/ 100,000');
    expect(formatCvChatCharCount(100)).toBe('100 characters');
  });

  it('detects over-limit input', () => {
    expect(isCvChatInputOverLimit(100_001)).toBe(true);
    expect(cvChatInputLimitErrorMessage(100_001)).toContain('100,000');
  });
});
