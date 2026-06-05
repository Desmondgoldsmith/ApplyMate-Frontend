import axios from 'axios';

import { getApiErrorCode } from '@/lib/axios';

export const INTERVIEW_PREP_QUOTA_PATH = '/interview-prep/quota';

export const INTERVIEW_PREP_WEEKLY_LIMIT_REACHED_CODE =
  'INTERVIEW_PREP_WEEKLY_LIMIT_REACHED' as const;

export const INTERVIEW_VOICE_PAID_ONLY_CODE = 'INTERVIEW_VOICE_PAID_ONLY' as const;

export const INTERVIEW_PREP_PRO_UPGRADE_MESSAGE =
  'Upgrade to Pro for unlimited practice sessions and AI voice feedback.';

export type InterviewPrepTier = 'FREE' | 'PAID' | string;

export type InterviewPrepQuota = {
  tier: InterviewPrepTier;
  weeklyLimit: number | null;
  sessionsCompletedThisWeek: number;
  sessionsRemaining: number | null;
  quotaResetsAt: string;
  quotaTimezone: string;
  voiceEnabled: boolean;
  upgradeMessage: string;
};

export type InterviewPrepWeeklyLimitDetails = {
  message: string;
  upgradeMessage: string;
  weeklyLimit: number | null;
  sessionsCompletedThisWeek: number | null;
  quotaResetsAt: string | null;
  voiceRequiresPaid: boolean;
};

function readStringField(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function readNumberOrNull(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  if (v === null) return null;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function readNumberField(obj: Record<string, unknown>, key: string, fallback = 0): number {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function readBoolField(obj: Record<string, unknown>, key: string, fallback = false): boolean {
  const v = obj[key];
  return typeof v === 'boolean' ? v : fallback;
}

export function parseInterviewPrepQuota(raw: unknown): InterviewPrepQuota | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;
  const data =
    root.data !== undefined && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : root;

  const tier = readStringField(data, 'tier') ?? 'FREE';
  const weeklyLimit = readNumberOrNull(data, 'weeklyLimit');
  const sessionsRemaining = readNumberOrNull(data, 'sessionsRemaining');
  const quotaResetsAt = readStringField(data, 'quotaResetsAt') ?? '';
  const quotaTimezone = readStringField(data, 'quotaTimezone') ?? 'UTC';

  return {
    tier,
    weeklyLimit,
    sessionsCompletedThisWeek: readNumberField(data, 'sessionsCompletedThisWeek', 0),
    sessionsRemaining,
    quotaResetsAt,
    quotaTimezone,
    voiceEnabled: readBoolField(data, 'voiceEnabled', false),
    upgradeMessage:
      readStringField(data, 'upgradeMessage') ?? INTERVIEW_PREP_PRO_UPGRADE_MESSAGE,
  };
}

export function isInterviewPrepPaidTier(quota: InterviewPrepQuota | null | undefined): boolean {
  if (!quota) return false;
  return (
    quota.tier.toUpperCase() === 'PAID' ||
    quota.weeklyLimit === null ||
    quota.sessionsRemaining === null
  );
}

export function isInterviewPrepWeeklyLimitReached(
  quota: InterviewPrepQuota | null | undefined,
): boolean {
  if (!quota || isInterviewPrepPaidTier(quota)) return false;
  return (quota.sessionsRemaining ?? 0) <= 0;
}

export function canStartInterviewPrepSession(
  quota: InterviewPrepQuota | null | undefined,
): boolean {
  if (!quota) return true;
  if (isInterviewPrepPaidTier(quota)) return true;
  return (quota.sessionsRemaining ?? 0) > 0;
}

export function formatInterviewPrepQuotaReset(
  iso: string,
  timezone = 'UTC',
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    });
  } catch {
    return d.toUTCString();
  }
}

function readQuotaFieldsFromObject(obj: Record<string, unknown>): Partial<InterviewPrepWeeklyLimitDetails> {
  return {
    message: readStringField(obj, 'message'),
    upgradeMessage: readStringField(obj, 'upgradeMessage'),
    weeklyLimit: readNumberOrNull(obj, 'weeklyLimit'),
    sessionsCompletedThisWeek: readNumberOrNull(obj, 'sessionsCompletedThisWeek'),
    quotaResetsAt: readStringField(obj, 'quotaResetsAt') ?? null,
    voiceRequiresPaid:
      obj.voiceRequiresPaid === true || readBoolField(obj, 'voiceRequiresPaid', false),
  };
}

/** Extract weekly-limit payload from a 429 `INTERVIEW_PREP_WEEKLY_LIMIT_REACHED` response. */
export function readInterviewPrepWeeklyLimitFromError(
  error: unknown,
): InterviewPrepWeeklyLimitDetails | null {
  if (!axios.isAxiosError(error)) return null;
  if (getApiErrorCode(error) !== INTERVIEW_PREP_WEEKLY_LIMIT_REACHED_CODE) return null;

  const data = error.response?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      message: '',
      upgradeMessage: INTERVIEW_PREP_PRO_UPGRADE_MESSAGE,
      weeklyLimit: 3,
      sessionsCompletedThisWeek: null,
      quotaResetsAt: null,
      voiceRequiresPaid: true,
    };
  }

  const root = data as Record<string, unknown>;
  const fromRoot = readQuotaFieldsFromObject(root);
  const errObj =
    root.error && typeof root.error === 'object' && !Array.isArray(root.error)
      ? (root.error as Record<string, unknown>)
      : null;
  const fromErr = errObj ? readQuotaFieldsFromObject(errObj) : {};

  return {
    message:
      fromRoot.message ??
      fromErr.message ??
      'Weekly interview practice limit reached.',
    upgradeMessage:
      fromRoot.upgradeMessage ??
      fromErr.upgradeMessage ??
      INTERVIEW_PREP_PRO_UPGRADE_MESSAGE,
    weeklyLimit: fromRoot.weeklyLimit ?? fromErr.weeklyLimit ?? 3,
    sessionsCompletedThisWeek:
      fromRoot.sessionsCompletedThisWeek ?? fromErr.sessionsCompletedThisWeek ?? null,
    quotaResetsAt: fromRoot.quotaResetsAt ?? fromErr.quotaResetsAt ?? null,
    voiceRequiresPaid:
      fromRoot.voiceRequiresPaid ??
      fromErr.voiceRequiresPaid ??
      true,
  };
}

export function readInterviewVoicePaidOnlyUpgradeMessage(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  if (getApiErrorCode(error) !== INTERVIEW_VOICE_PAID_ONLY_CODE) return null;
  const data = error.response?.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return INTERVIEW_PREP_PRO_UPGRADE_MESSAGE;
  }
  const root = data as Record<string, unknown>;
  return (
    readStringField(root, 'upgradeMessage') ??
    (root.error && typeof root.error === 'object' && !Array.isArray(root.error)
      ? readStringField(root.error as Record<string, unknown>, 'upgradeMessage')
      : undefined) ??
    readStringField(root, 'message') ??
    INTERVIEW_PREP_PRO_UPGRADE_MESSAGE
  );
}
