import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';

import { isInterviewPrepWeeklyLimitApiError } from '@/lib/axios';
import {
  canStartInterviewPrepSession,
  isInterviewPrepWeeklyLimitReached,
  parseInterviewPrepQuota,
  readInterviewPrepWeeklyLimitFromError,
  readInterviewVoicePaidOnlyUpgradeMessage,
} from '@/lib/interviewPrepQuota';

describe('parseInterviewPrepQuota', () => {
  it('parses free tier quota', () => {
    const q = parseInterviewPrepQuota({
      tier: 'FREE',
      weeklyLimit: 3,
      sessionsCompletedThisWeek: 1,
      sessionsRemaining: 2,
      quotaResetsAt: '2026-06-08T00:00:00.000Z',
      quotaTimezone: 'UTC',
      voiceEnabled: false,
      upgradeMessage: 'Upgrade to Pro for unlimited practice sessions and AI voice feedback.',
    });
    expect(q).toMatchObject({
      tier: 'FREE',
      weeklyLimit: 3,
      sessionsRemaining: 2,
      voiceEnabled: false,
    });
  });

  it('parses paid tier quota', () => {
    const q = parseInterviewPrepQuota({
      tier: 'PAID',
      weeklyLimit: null,
      sessionsCompletedThisWeek: 12,
      sessionsRemaining: null,
      quotaResetsAt: '2026-06-08T00:00:00.000Z',
      quotaTimezone: 'UTC',
      voiceEnabled: true,
      upgradeMessage: 'Upgrade to Pro for unlimited practice sessions and AI voice feedback.',
    });
    expect(q).toMatchObject({
      tier: 'PAID',
      weeklyLimit: null,
      sessionsRemaining: null,
      voiceEnabled: true,
    });
  });
});

describe('interview prep quota guards', () => {
  const freeWithRemaining = parseInterviewPrepQuota({
    tier: 'FREE',
    weeklyLimit: 3,
    sessionsCompletedThisWeek: 1,
    sessionsRemaining: 2,
    quotaResetsAt: '2026-06-08T00:00:00.000Z',
    quotaTimezone: 'UTC',
    voiceEnabled: false,
    upgradeMessage: 'Upgrade',
  })!;

  const freeAtLimit = parseInterviewPrepQuota({
    tier: 'FREE',
    weeklyLimit: 3,
    sessionsCompletedThisWeek: 3,
    sessionsRemaining: 0,
    quotaResetsAt: '2026-06-08T00:00:00.000Z',
    quotaTimezone: 'UTC',
    voiceEnabled: false,
    upgradeMessage: 'Upgrade',
  })!;

  it('detects weekly limit reached', () => {
    expect(isInterviewPrepWeeklyLimitReached(freeWithRemaining)).toBe(false);
    expect(isInterviewPrepWeeklyLimitReached(freeAtLimit)).toBe(true);
    expect(canStartInterviewPrepSession(freeWithRemaining)).toBe(true);
    expect(canStartInterviewPrepSession(freeAtLimit)).toBe(false);
  });
});

describe('interview prep API errors', () => {
  function makeAxiosError(data: unknown, status = 429): AxiosError {
    const cfg = { url: '/interviews' } as InternalAxiosRequestConfig;
    return new AxiosError('fail', undefined, cfg, undefined, {
      status,
      data,
      statusText: 'Error',
      headers: {},
      config: cfg,
    });
  }

  it('reads weekly limit 429 payload', () => {
    const err = makeAxiosError({
      code: 'INTERVIEW_PREP_WEEKLY_LIMIT_REACHED',
      message: 'Weekly limit reached',
      upgradeMessage: 'Upgrade to Pro for unlimited practice sessions and AI voice feedback.',
      weeklyLimit: 3,
      sessionsCompletedThisWeek: 3,
      quotaResetsAt: '2026-06-08T00:00:00.000Z',
      voiceRequiresPaid: true,
    });
    expect(isInterviewPrepWeeklyLimitApiError(err)).toBe(true);
    expect(readInterviewPrepWeeklyLimitFromError(err)?.upgradeMessage).toMatch(
      /Upgrade to Pro/i,
    );
  });

  it('reads voice paid-only 403 payload', () => {
    const err = makeAxiosError(
      {
        code: 'INTERVIEW_VOICE_PAID_ONLY',
        upgradeMessage: 'Upgrade to Pro for unlimited practice sessions and AI voice feedback.',
      },
      403,
    );
    expect(readInterviewVoicePaidOnlyUpgradeMessage(err)).toMatch(/Upgrade to Pro/i);
  });
});
