import { describe, expect, it, vi } from 'vitest';

import { compactDiffPreviewPerformance, logCvMaterializePerformanceDev } from '@/lib/cvApplyPerformanceDev';

describe('compactDiffPreviewPerformance', () => {
  it('returns undefined when no telemetry keys are set', () => {
    expect(compactDiffPreviewPerformance({})).toBeUndefined();
  });

  it('keeps only defined fields', () => {
    expect(
      compactDiffPreviewPerformance({
        cacheHit: true,
        latencyMs: 42,
        usedSectionScopedPrompt: undefined,
      }),
    ).toEqual({ cacheHit: true, latencyMs: 42 });
  });
});

describe('logCvMaterializePerformanceDev', () => {
  it('does not log when NODE_ENV is not development', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    logCvMaterializePerformanceDev('test', { latencyMs: 10 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
