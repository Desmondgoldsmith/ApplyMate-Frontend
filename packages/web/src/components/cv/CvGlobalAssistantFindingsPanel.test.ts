import { describe, expect, it } from 'vitest';

import {
  buildApplyRecruiterFindingsPayload,
  buildGlobalFixPromptFromFindings,
} from '@/lib/cvGlobalAssistant';

describe('buildApplyRecruiterFindingsPayload', () => {
  it('targets apply_recruiter_findings operation', () => {
    const payload = buildApplyRecruiterFindingsPayload(['Fix summary'], 'cmd-9');
    expect(payload.operation).toBe('apply_recruiter_findings');
    expect(payload.scanCommandId).toBe('cmd-9');
    expect(payload.findings).toEqual(['Fix summary']);
  });
});

describe('buildGlobalFixPromptFromFindings', () => {
  it('bundles findings into a full-CV global command', () => {
    const prompt = buildGlobalFixPromptFromFindings([
      'Add metrics to experience bullets.',
      'Shorten the summary.',
    ]);
    expect(prompt).toContain('entire CV');
    expect(prompt).toContain('Add metrics to experience bullets.');
    expect(prompt).toContain('Shorten the summary.');
  });
});
