import { describe, expect, it } from 'vitest';

import {
  CV_GLOBAL_ASSISTANT_DEFAULT_PRESETS,
  resolveGlobalAssistantPresets,
} from '@/lib/cvGlobalAssistantPresets';

describe('resolveGlobalAssistantPresets', () => {
  it('returns all seven default presets when API is empty', () => {
    const presets = resolveGlobalAssistantPresets([]);
    expect(presets).toHaveLength(7);
    expect(presets[0]?.exampleCommand).toContain('action verbs');
    expect(presets.find((p) => p.operation === 'recruiter_scan')?.scope).toBe(
      'findings',
    );
  });

  it('prefers API exampleCommand when provided', () => {
    const presets = resolveGlobalAssistantPresets([
      {
        operation: 'add_metrics',
        label: 'Metrics',
        description: '',
        exampleCommand: 'Custom metrics prompt from API.',
        affectedScopeLabel: 'Entire resume',
        scope: 'full_cv',
      },
    ]);
    const metrics = presets.find((p) => p.operation === 'add_metrics');
    expect(metrics?.exampleCommand).toBe('Custom metrics prompt from API.');
    expect(presets).toHaveLength(CV_GLOBAL_ASSISTANT_DEFAULT_PRESETS.length);
  });
});
