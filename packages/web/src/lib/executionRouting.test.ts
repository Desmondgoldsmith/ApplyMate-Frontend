import { describe, expect, it } from 'vitest';

import { resolveExecutionDestination } from '@/lib/executionRouting';

describe('resolveExecutionDestination', () => {
  it('prefers canonical route with full query string', () => {
    const out = resolveExecutionDestination({
      kind: 'analyze',
      executionPayload: {
        canonicalRoute: '/dashboard/jobs?jobId=ja-123&focus=analysis',
        deepLink: '/dashboard/jobs',
        fallbackRoute: '/dashboard/jobs',
        resolutionState: 'resolved',
      },
      safeFallback: '/dashboard/jobs',
    });
    expect(out.href).toBe('/dashboard/jobs?jobId=ja-123&focus=analysis');
    expect(out.reason).toBe('canonical');
  });

  it('falls back to deepLink when canonical is missing', () => {
    const out = resolveExecutionDestination({
      kind: 'follow_up',
      executionContext: {
        deepLink: '/dashboard/jobs?applicationId=app-11&focus=followup',
        resolutionState: 'resolved',
      },
      safeFallback: '/dashboard/jobs',
    });
    expect(out.href).toBe('/dashboard/jobs?applicationId=app-11&focus=followup');
    expect(out.reason).toBe('deepLink');
  });

  it('prefers journey route over fallback/cta when canonical and deep are absent', () => {
    const out = resolveExecutionDestination({
      kind: 'analyze',
      journeyNextRoute: '/dashboard/jobs?jobId=ja-42&focus=analysis',
      executionContext: {
        fallbackRoute: '/dashboard/jobs',
      },
      safeFallback: '/dashboard/jobs',
    });
    expect(out.href).toBe('/dashboard/jobs?jobId=ja-42&focus=analysis');
    expect(out.reason).toBe('journey');
  });
});
