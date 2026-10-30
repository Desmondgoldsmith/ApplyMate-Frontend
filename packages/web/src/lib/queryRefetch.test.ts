import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  FAILED_QUERY_REMOUNT_COOLDOWN_MS,
  refetchOnMountUnlessJustFailed,
} from '@/lib/queryRefetch';

const NOW = 1_700_000_000_000;

function query(status: 'pending' | 'error' | 'success', errorUpdatedAt = 0) {
  return { state: { status, errorUpdatedAt } };
}

describe('refetchOnMountUnlessJustFailed', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refetches successful and pending queries on mount', () => {
    expect(refetchOnMountUnlessJustFailed(query('success'))).toBe(true);
    expect(refetchOnMountUnlessJustFailed(query('pending'))).toBe(true);
  });

  it('skips a query that failed within the cooldown', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(refetchOnMountUnlessJustFailed(query('error', NOW - 1_000))).toBe(
      false,
    );
  });

  it('retries a failed query once the cooldown has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(
      refetchOnMountUnlessJustFailed(
        query('error', NOW - FAILED_QUERY_REMOUNT_COOLDOWN_MS),
      ),
    ).toBe(true);
  });
});
