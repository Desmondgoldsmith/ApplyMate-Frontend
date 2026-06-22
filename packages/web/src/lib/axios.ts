import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** When true, 401 responses do not trigger token refresh (auth endpoints). */
    skipAuthRefresh?: boolean;
    /** Set after a successful refresh retry to avoid infinite loops. */
    _authRetry?: boolean;
  }
  interface InternalAxiosRequestConfig {
    skipAuthRefresh?: boolean;
    _authRetry?: boolean;
  }
}

import { readApplymateTokenFromCookie } from '@/lib/authCookie';
import { CV_PHOTO_TOO_LARGE_USER_MESSAGE } from '@/lib/cvPhotoCompress';
import {
  BACKEND_TIMEOUT_ERROR_CODE,
  BACKEND_UNREACHABLE_ERROR_CODE,
} from '@/lib/devBackendProxy';
import { applyNgrokSkipHeaders } from '@/lib/ngrokTunnel';
import {
  readRequestIdFromHeaders,
  setLastRequestId,
} from '@/lib/observability/requestId';

/** Lazy read — top-level import of useAuthStore creates a cycle: axios → store → api → interview-prep-api → axios. */
function readAccessTokenFromMemory(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require('@/store/useAuthStore') as typeof import('@/store/useAuthStore');
    return useAuthStore.getState().accessToken?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Backend API base (trailing slash). Prefer NEXT_PUBLIC_API_URL in .env.local
 * e.g. http://localhost:3000/api/ — must include the `/api` segment (Nest `setGlobalPrefix('api')`).
 * If the frontend is on :3001 and the API on :3000, the API must allow CORS for :3001.
 */
function resolveAbsoluteApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`;
  }
  return 'http://localhost:3000/api/';
}

export {
  BACKEND_TIMEOUT_ERROR_CODE,
  BACKEND_UNREACHABLE_ERROR_CODE,
} from '@/lib/devBackendProxy';

/** Dev-only browser proxy prefix (see `app/backend-api/[...path]/route.ts`). */
export const DEV_BROWSER_API_PREFIX = '/backend-api/';

function resolveApiBaseUrl(): string {
  const absolute = resolveAbsoluteApiBaseUrl();
  // Dev browser: same-origin proxy avoids CORS to :3000. Works for localhost and ngrok
  // tunnels pointing at this Next dev server — do not call localhost:3000 from a remote origin.
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    return DEV_BROWSER_API_PREFIX;
  }
  return absolute;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  /** Fail fast when Nest is hung; dev proxy uses the same ceiling. */
  timeout: 90_000,
});

axiosClient.interceptors.response.use((response) => {
  const requestId = readRequestIdFromHeaders(
    response.headers as Record<string, unknown>,
  );
  if (requestId) setLastRequestId(requestId);
  return response;
});

axiosClient.interceptors.request.use((config) => {
  applyNgrokSkipHeaders(config, API_BASE_URL);
  if (typeof window !== 'undefined') {
    const fromMemory = readAccessTokenFromMemory();
    const fromCookie = readApplymateTokenFromCookie()?.trim();
    const token = fromMemory || fromCookie;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/** Correlate CV/AI requests with server logs (Phase 7); server echoes `X-Request-Id` when provided. */
axiosClient.interceptors.request.use((config) => {
  const method = (config.method || 'get').toUpperCase();
  const path = `${config.baseURL ?? ''}${config.url ?? ''}`;
  if (
    !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ||
    !/\/cv\//i.test(path)
  ) {
    return config;
  }
  const headers = config.headers ?? {};
  const getHeader = (k: string): string | undefined => {
    const v = headers[k as keyof typeof headers];
    if (typeof v === 'string' && v.trim()) return v.trim();
    return undefined;
  };
  if (getHeader('X-Request-Id') || getHeader('x-request-id')) return config;
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `fe-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  (headers as Record<string, string>)['X-Request-Id'] = id;
  config.headers = headers;
  return config;
});

export type ErrorBody = {
  message?: string | string[];
  success?: boolean;
  /** Phase 7 API envelope — present on many error responses. */
  requestId?: string;
  error?:
    | string
    | {
        message?: string | string[];
        code?: string;
        statusCode?: number;
        /** Optional quota hints (Nest CV assistant / shared AI limits). */
        used?: number;
        dailyQuota?: number;
        retryAfterSeconds?: number;
      };
};

/**
 * When the backend returns HTTP 200 with `{ success: false, error?: {...} }`, axios does not throw.
 * Call this after `post`/`get` to reject with an AxiosError so `getApiErrorMessage` and mutations work.
 */
export function throwIfApiFailureResponse(
  data: unknown,
  httpStatus?: number,
): void {
  if (data === null || typeof data !== 'object') return;
  const o = data as Record<string, unknown>;
  if (o.success !== false) return;
  const nested = o.error;
  const fromNested =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? Number((nested as { statusCode?: number }).statusCode)
      : undefined;
  const status =
    httpStatus ?? (Number.isFinite(fromNested) ? fromNested : undefined) ?? 500;
  throw new AxiosError<ErrorBody>(
    'API reported failure',
    AxiosError.ERR_BAD_RESPONSE,
    undefined,
    undefined,
    {
      data: data as ErrorBody,
      status,
      statusText: 'Error',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    },
  );
}

function pickMessage(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === 'string'
  ) {
    return value.join(' ');
  }
  return undefined;
}

export type NestedApiError = {
  httpStatus?: number;
  appStatusCode?: number;
  code?: string;
  message?: string;
  used?: number;
  dailyQuota?: number;
  retryAfterSeconds?: number;
};

function readNumberField(
  obj: Record<string, unknown>,
  key: string,
): number | undefined {
  const v = obj[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function readNestedApiError(data: unknown): NestedApiError {
  if (!data || typeof data !== 'object') return {};
  const root = data as Record<string, unknown>;
  const httpStatus =
    typeof root.statusCode === 'number' ? root.statusCode : undefined;
  /** Nest / gateway flat shape: `{ code, message }` on the response body. */
  const flatCode = typeof root.code === 'string' ? root.code : undefined;
  const flatMessage = pickMessage(root.message);
  const err = root.error;
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    const e = err as Record<string, unknown>;
    return {
      httpStatus,
      appStatusCode:
        typeof e.statusCode === 'number' ? e.statusCode : undefined,
      code: typeof e.code === 'string' ? e.code : flatCode,
      message: pickMessage(e.message) ?? flatMessage,
      used: readNumberField(e, 'used'),
      dailyQuota: readNumberField(e, 'dailyQuota'),
      retryAfterSeconds: readNumberField(e, 'retryAfterSeconds'),
    };
  }
  return {
    httpStatus,
    code: flatCode,
    message: flatMessage,
  };
}

/** Nest `ConflictException` / API envelope — CV improvement invalid partial field selection (409). */
export type CvImprovementInvalidFieldSelectionDetails = {
  receivedFields?: string[];
  expectedSelectableKeys?: string[];
  pointer?: string;
  resolvedIndex?: number;
};

function readCvImprovementDetailsObject(
  data: unknown,
): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const root = data as Record<string, unknown>;
  const d1 = root.details;
  if (d1 && typeof d1 === 'object' && !Array.isArray(d1))
    return d1 as Record<string, unknown>;
  const err = root.error;
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    const ed = (err as Record<string, unknown>).details;
    if (ed && typeof ed === 'object' && !Array.isArray(ed))
      return ed as Record<string, unknown>;
  }
  return null;
}

function parseStringIdArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim());
  return out.length > 0 ? out : undefined;
}

/**
 * Reads `details` from a 409 `IMPROVEMENT_INVALID_FIELD_SELECTION` body (shape unchanged across CvImprovementService split).
 * Returns `null` when the error is not that code; returns `{}` when the code matches but `details` is absent.
 */
export function readCvImprovementInvalidFieldSelectionDetails(
  error: unknown,
): CvImprovementInvalidFieldSelectionDetails | null {
  if (!axios.isAxiosError(error)) return null;
  const ax = error as AxiosError<ErrorBody>;
  const nested = readNestedApiError(ax.response?.data);
  if (nested.code !== 'IMPROVEMENT_INVALID_FIELD_SELECTION') return null;
  const raw = readCvImprovementDetailsObject(ax.response?.data);
  if (!raw) return {};
  const resolvedRaw = raw.resolvedIndex;
  const resolvedIndex =
    typeof resolvedRaw === 'number' && Number.isFinite(resolvedRaw)
      ? resolvedRaw
      : typeof resolvedRaw === 'string' && /^\d+$/.test(resolvedRaw)
        ? Number(resolvedRaw)
        : undefined;
  return {
    receivedFields: parseStringIdArray(raw.receivedFields),
    expectedSelectableKeys: parseStringIdArray(raw.expectedSelectableKeys),
    pointer:
      typeof raw.pointer === 'string' && raw.pointer.trim()
        ? raw.pointer.trim()
        : undefined,
    resolvedIndex,
  };
}

/** Same nested `code` extraction as {@link getApiErrorMessage} — use for improvement retry branches. */
export function getApiErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError(error)) return null;
  const ax = error as AxiosError<ErrorBody>;
  const c = readNestedApiError(ax.response?.data).code?.trim();
  return c && c.length > 0 ? c : null;
}

/** Backend Phase 2 — assistant commit rejected merged patch for factuality / structural safety. */
export const CV_ASSISTANT_COMMIT_REJECTED_FACTUALITY_CODE =
  'CV_ASSISTANT_COMMIT_REJECTED_FACTUALITY' as const;

export const CV_ASSISTANT_COMMIT_FACTUALITY_USER_MESSAGE =
  "This change couldn't be applied because it isn't supported by what's saved on your CV. Edit manually or refresh and try again.";

function extractTruthfulnessWarningsFromApiData(data: unknown): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return [];
  const root = data as Record<string, unknown>;
  const fromObj = (o: Record<string, unknown>): string[] => {
    const w = o.truthfulnessWarnings ?? o.truthfulness_warnings;
    if (!Array.isArray(w)) return [];
    return w
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((s) => s.trim());
  };
  const err = root.error;
  if (err && typeof err === 'object' && !Array.isArray(err)) {
    return fromObj(err as Record<string, unknown>);
  }
  return fromObj(root);
}

/** True when POST …/assistant/commit returned 422 with factuality rejection (Phase 2 CV). */
export function isCvAssistantCommitRejectedForFactuality(
  error: unknown,
): boolean {
  if (!axios.isAxiosError(error)) return false;
  const ax = error as AxiosError<ErrorBody>;
  if (ax.response?.status !== 422) return false;
  const nested = readNestedApiError(ax.response?.data);
  return nested.code === CV_ASSISTANT_COMMIT_REJECTED_FACTUALITY_CODE;
}

/** Matches Nest auth routes whether `url` is absolute, root-relative, or relative to `baseURL`. */
const AUTH_SUBPATH =
  /(^|\/)(auth\/login|auth\/register|auth\/refresh)(\/?$|[/?#])/i;

function isAuthThrottleRequestUrl(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_SUBPATH.test(url);
}

/** HTTP 429 on auth endpoints (rate limiting); distinct from AI daily quota. */
export function isAuthRateLimitError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const ax = error as AxiosError<ErrorBody>;
  return (
    ax.response?.status === 429 && isAuthThrottleRequestUrl(ax.config?.url)
  );
}

/** True when the browser could not complete a request (proxy reset, Nest down, offline). */
export function isBackendConnectionError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const ax = error as AxiosError<ErrorBody>;
  if (ax.response?.status === 502) {
    const nested = readNestedApiError(ax.response.data);
    return (
      nested.code === BACKEND_UNREACHABLE_ERROR_CODE ||
      nested.code === BACKEND_TIMEOUT_ERROR_CODE
    );
  }
  const msg = `${ax.code ?? ''} ${ax.message ?? ''}`.toLowerCase();
  return (
    ax.code === 'ERR_NETWORK' ||
    ax.code === 'ECONNABORTED' ||
    ax.code === 'ETIMEDOUT' ||
    msg.includes('network error') ||
    msg.includes('socket hang up') ||
    msg.includes('econnreset')
  );
}

/** TanStack Query: avoid retry storms on throttling, auth failures, or dead backend. */
export function shouldRetryFailedQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= 2) return false;
  if (isBackendConnectionError(error)) return false;
  if (!axios.isAxiosError(error)) return true;
  const s = error.response?.status;
  if (s === 429 || s === 401 || s === 403 || s === 502 || s === 503) return false;
  return true;
}

/** User-facing copy for auth endpoint rate limits (backend Phase 0). */
export const AUTH_RATE_LIMIT_USER_MESSAGE =
  'Too many attempts. Please wait a minute and try again.';

/** Generic copy when the server returns 5xx without safe detail (backend Phase 0). */
export const GENERIC_SERVER_ERROR_USER_MESSAGE =
  'Something went wrong on our side. Please try again in a moment.';

/** Free tier exhausted weekly interview practice sessions (distinct from daily AI quota). */
export function isInterviewPrepWeeklyLimitApiError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const nested = readNestedApiError(
    (error as AxiosError<ErrorBody>).response?.data,
  );
  return nested.code === 'INTERVIEW_PREP_WEEKLY_LIMIT_REACHED';
}

/** ElevenLabs interviewer TTS is Pro-only (`POST /interviews/:id/speech`). */
export function isInterviewVoicePaidOnlyApiError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const ax = error as AxiosError<ErrorBody>;
  const nested = readNestedApiError(ax.response?.data);
  return (
    nested.code === 'INTERVIEW_VOICE_PAID_ONLY' ||
    (ax.response?.status === 403 && nested.code === 'INTERVIEW_VOICE_PAID_ONLY')
  );
}

export const ACCEPT_ALL_DAILY_QUOTA_EXHAUSTED_CODE =
  'ACCEPT_ALL_DAILY_QUOTA_EXHAUSTED' as const;

export const ACCEPT_ALL_IN_PROGRESS_CODE = 'ACCEPT_ALL_IN_PROGRESS' as const;

export const ACCEPT_ALL_ABORTED_TIMEOUT_CODE =
  'ACCEPT_ALL_ABORTED_TIMEOUT' as const;

/** True when another accept-all is already running for this profile (409). */
export function isAcceptAllInProgressError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const nested = readNestedApiError(
    (error as AxiosError<ErrorBody>).response?.data,
  );
  return nested.code === ACCEPT_ALL_IN_PROGRESS_CODE;
}

/** True when accept-all was aborted after HTTP timeout — CV unchanged (409). */
export function isAcceptAllAbortedTimeoutError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const nested = readNestedApiError(
    (error as AxiosError<ErrorBody>).response?.data,
  );
  return nested.code === ACCEPT_ALL_ABORTED_TIMEOUT_CODE;
}

/** 504/408 or client timeout on accept-all — do not assume success; re-fetch CV state. */
export function isAcceptAllHttpTimeoutError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const ax = error as AxiosError<ErrorBody>;
  const url = `${ax.config?.url ?? ''}`;
  if (!/\/cv\/suggestions\/accept-all/i.test(url)) return false;
  const status = ax.response?.status;
  if (status === 504 || status === 408) return true;
  return (
    ax.code === 'ECONNABORTED' ||
    (typeof ax.message === 'string' && /\btimeout\b/i.test(ax.message))
  );
}

/** True when apply-all hit the daily AI cap (429 + structured quota payload). */
export function isAcceptAllDailyQuotaExhaustedError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const nested = readNestedApiError(
    (error as AxiosError<ErrorBody>).response?.data,
  );
  return nested.code === ACCEPT_ALL_DAILY_QUOTA_EXHAUSTED_CODE;
}

/** True when the API indicates daily free-AI quota exhaustion (`error.code` or HTTP 429 + quota shape). */
export function isDailyAiLimitApiError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const ax = error as AxiosError<ErrorBody>;
  if (isAuthThrottleRequestUrl(ax.config?.url)) return false;
  const nested = readNestedApiError(ax.response?.data);
  if (nested.code === 'RATE_LIMITED') return false;
  const responseStatus = ax.response?.status;
  const effectiveStatus =
    nested.appStatusCode ?? responseStatus ?? nested.httpStatus;
  const payloadBlob =
    typeof ax.response?.data === 'object' && ax.response?.data
      ? JSON.stringify(ax.response.data).toLowerCase()
      : '';
  const combinedForQuota = `${nested.code ?? ''} ${nested.message ?? ''} ${payloadBlob}`;
  if (nested.code === 'INTERVIEW_PREP_WEEKLY_LIMIT_REACHED') return false;
  return (
    nested.code === 'DAILY_AI_LIMIT_REACHED' ||
    nested.code === ACCEPT_ALL_DAILY_QUOTA_EXHAUSTED_CODE ||
    effectiveStatus === 429 ||
    responseStatus === 429 ||
    combinedForQuota.includes('daily free ai limit') ||
    combinedForQuota.includes('try again tomorrow') ||
    (combinedForQuota.includes('daily') &&
      combinedForQuota.includes('limit') &&
      (combinedForQuota.includes('free') || combinedForQuota.includes('ai'))) ||
    (combinedForQuota.includes('quota') && combinedForQuota.includes('ai'))
  );
}

function formatDailyAiQuotaSuffix(meta: NestedApiError): string {
  const bits: string[] = [];
  const { used, dailyQuota, retryAfterSeconds } = meta;
  if (
    typeof used === 'number' &&
    typeof dailyQuota === 'number' &&
    dailyQuota > 0
  ) {
    bits.push(`${used} of ${dailyQuota} uses today`);
  }
  if (typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0) {
    const m = Math.ceil(retryAfterSeconds / 60);
    bits.push(
      m >= 60 ? `try again in ${Math.ceil(m / 60)}h` : `try again in ${m}m`,
    );
  }
  return bits.length ? ` ${bits.join(' · ')}` : '';
}

/** Lowercased blob of API + axios messages — for matching transient AI parse failures without exposing raw errors. */
function collectApiErrorTextForMatch(error: unknown): string {
  if (!axios.isAxiosError(error)) return '';
  const ax = error as AxiosError<ErrorBody>;
  const parts: string[] = [];
  const data = ax.response?.data;
  const nested = readNestedApiError(data);
  if (nested.message) parts.push(nested.message);
  if (data && typeof data === 'object') {
    const d = data as ErrorBody;
    const top = pickMessage(d.message);
    if (top) parts.push(top);
    if (typeof d.error === 'string') parts.push(d.error);
    if (d.error && typeof d.error === 'object') {
      const nestedMsg = pickMessage((d.error as { message?: unknown }).message);
      if (nestedMsg) parts.push(nestedMsg);
    }
  }
  if (ax.message) parts.push(ax.message);
  return parts.join(' | ').toLowerCase();
}

/**
 * Backend often fails closed when the model returns prose, markdown fences, or malformed JSON.
 * These failures are usually transient — extra retries help without changing the API.
 */
export function isTransientAiStructuredOutputError(error: unknown): boolean {
  const t = collectApiErrorTextForMatch(error);
  if (!t) return false;
  return (
    t.includes('invalid json') ||
    t.includes('unexpected token') ||
    t.includes('unexpected end of json') ||
    (t.includes('json') && (t.includes('parse') || t.includes('parsing'))) ||
    (t.includes('ai') && t.includes('json'))
  );
}

const TRANSIENT_AI_STRUCTURED_OUTPUT_MESSAGE =
  'We could not read the AI response for your CV. This is often temporary—please try again in a few seconds. If it keeps happening, try a shorter excerpt, a smaller file, or PDF instead of DOCX.';

/** TanStack Query `retry` predicate for CV parse uploads (file multipart). */
export function cvParseMutationShouldRetry(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= 6) return false;
  if (isTransientAiStructuredOutputError(error)) return failureCount < 5;
  return failureCount < 2;
}

/** User-facing copy when our free AI module is overloaded or unavailable (job analyze, CV parse, etc.). */
const SERVICE_UNAVAILABLE_USER_MESSAGE =
  'Our free AI module is temporarily unavailable—often due to high demand or rate limits. Please wait a moment and try again.';

/** Avoid echoing vendor names from API payloads in the UI. */
function mentionsThirdPartyAiVendor(message: string): boolean {
  return (
    /\bgemini\b/i.test(message) ||
    /\bopenai\b/i.test(message) ||
    /\bclaude\b/i.test(message)
  );
}

function userFacingServiceUnavailableMessage(
  apiMessage: string | undefined,
): string {
  const trimmed = apiMessage?.trim();
  if (trimmed && !mentionsThirdPartyAiVendor(trimmed)) {
    return trimmed;
  }
  return SERVICE_UNAVAILABLE_USER_MESSAGE;
}

function scrubVendorNamesFromUserMessage(text: string): string {
  return mentionsThirdPartyAiVendor(text)
    ? SERVICE_UNAVAILABLE_USER_MESSAGE
    : text;
}

/** 413 or backend message — oversized JSON body (e.g. base64 photo). */
export function isPayloadTooLargeError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const ax = error as AxiosError<unknown>;
  if (ax.response?.status === 413) return true;
  const payload = ax.response?.data;
  const blob =
    `${ax.message} ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`.toLowerCase();
  return (
    blob.includes('payload too large') ||
    blob.includes('entity too large') ||
    blob.includes('request entity too large') ||
    blob.includes('body exceeded') ||
    blob.includes('payloadtoolarge')
  );
}

const CV_AI_TIMEOUT_USER_MESSAGE =
  'This AI request timed out. Wait a moment, try again, or make a smaller change if it keeps happening.';

/** Strip dev-only trailers so toasts and inline UI never show raw correlation IDs. */
function stripUserFacingDebugTrailer(message: string): string {
  return message
    .replace(/\s*\[Debug\]\s*requestId:\s*[a-fA-F0-9-]+\s*$/gim, '')
    .replace(/\s*\[Debug\][^\n]*$/gim, '')
    .trim();
}

function getApiErrorMessageBase(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (isPayloadTooLargeError(error)) {
      return CV_PHOTO_TOO_LARGE_USER_MESSAGE;
    }
    const ax = error as AxiosError<ErrorBody>;
    const data = ax.response?.data;
    const responseStatus = ax.response?.status;
    const nested = readNestedApiError(data);

    const effectiveStatus =
      nested.appStatusCode ?? responseStatus ?? nested.httpStatus;

    if (isAuthRateLimitError(error)) {
      return AUTH_RATE_LIMIT_USER_MESSAGE;
    }

    if (isBackendConnectionError(error)) {
      const nested = readNestedApiError(ax.response?.data);
      if (nested.code === BACKEND_TIMEOUT_ERROR_CODE) {
        return 'The API server took too long to respond. Try again, or restart the Nest backend if it is stuck.';
      }
      if (nested.message?.trim()) {
        return nested.message.trim();
      }
      return 'Cannot reach the API server. Confirm the backend is running on port 3000 (or your NEXT_PUBLIC_API_URL) and try again.';
    }

    if (nested.code === 'RATE_LIMITED') {
      const sec = nested.retryAfterSeconds;
      const approxMin =
        typeof sec === 'number' && sec > 0
          ? Math.max(1, Math.ceil(sec / 60))
          : 1;
      return `Too many requests. Please wait about ${approxMin} minute(s), then try again.`;
    }

    const isClientTimeout =
      ax.code === 'ECONNABORTED' ||
      ax.code === 'ETIMEDOUT' ||
      (typeof ax.message === 'string' && /\btimeout\b/i.test(ax.message));
    if (isClientTimeout) {
      return CV_AI_TIMEOUT_USER_MESSAGE;
    }

    if (nested.code === 'IMPROVEMENT_DRAFT_FIELD_MISMATCH') {
      return 'The selected fields do not match the stored preview. Close the preview and run Fix with AI again.';
    }

    const staleCodes = new Set([
      'IMPROVEMENT_STALE_DRAFT',
      'IMPROVEMENT_STALE_INDEX',
      'IMPROVEMENT_DRAFT_FIELD_MISMATCH',
      'STALE_DRAFT',
    ]);
    const msgLower = nested.message?.toLowerCase() ?? '';
    if (
      (nested.code && staleCodes.has(nested.code)) ||
      (responseStatus === 409 &&
        (/\bstale\b/.test(msgLower) ||
          /\bdraft\b/.test(msgLower) ||
          /\brevision\b/.test(msgLower)))
    ) {
      return 'This suggestion no longer matches your CV (the draft or revision changed). Refresh or reopen it and try again.';
    }

    if (
      responseStatus === 409 &&
      nested.code === 'IMPROVEMENT_INVALID_FIELD_SELECTION'
    ) {
      const det = readCvImprovementInvalidFieldSelectionDetails(ax);
      const keys = det?.expectedSelectableKeys;
      if (keys?.length) {
        const preview = keys.slice(0, 8).join(', ');
        const suffix = keys.length > 8 ? '…' : '';
        return `That field selection isn’t valid for this suggestion. You can try: ${preview}${suffix}.`;
      }
      const detail = nested.message?.trim();
      if (detail) return scrubVendorNamesFromUserMessage(detail);
      return 'That field selection isn’t valid for this suggestion. Reopen the preview or refresh and try again.';
    }

    if (responseStatus === 422 || effectiveStatus === 422) {
      if (nested.code === 'IMPROVEMENT_MATERIALIZE_FAILED') {
        const detail = nested.message?.trim();
        if (detail) {
          return scrubVendorNamesFromUserMessage(detail);
        }
        return 'Could not generate a suggestion for this improvement. Please try again.';
      }
      if (nested.code === CV_ASSISTANT_COMMIT_REJECTED_FACTUALITY_CODE) {
        const hints = extractTruthfulnessWarningsFromApiData(data);
        const first = hints[0];
        if (first) {
          return `${CV_ASSISTANT_COMMIT_FACTUALITY_USER_MESSAGE} ${scrubVendorNamesFromUserMessage(first)}`;
        }
        return CV_ASSISTANT_COMMIT_FACTUALITY_USER_MESSAGE;
      }
      const detail = nested.message?.trim();
      if (detail)
        return scrubVendorNamesFromUserMessage(
          `We could not validate that: ${detail}`,
        );
      return 'Something in that request could not be validated. Check the form and try again.';
    }

    if (responseStatus === 504 || responseStatus === 408) {
      const url = `${ax.config?.baseURL ?? ''}${ax.config?.url ?? ''}`;
      if (/\/cv\//i.test(url)) {
        return 'The server took too long to respond. Please wait a moment and try again.';
      }
    }

    if (
      responseStatus === 500 ||
      responseStatus === 502 ||
      responseStatus === 504
    ) {
      const detail = nested.message?.trim();
      const looksUnsafe =
        !detail ||
        /\b(stack trace|stack:|at\s+\w+\.|debug detail|internal error ref|must not surface)\b/i.test(
          detail,
        );
      if (detail && !looksUnsafe) {
        return scrubVendorNamesFromUserMessage(detail);
      }
      return GENERIC_SERVER_ERROR_USER_MESSAGE;
    }

    if (isDailyAiLimitApiError(error)) {
      const m = nested.message?.trim();
      const quotaSuffix = formatDailyAiQuotaSuffix(nested);
      const generic =
        m &&
        /could not fulfill|please try again|unprocessable/i.test(m) &&
        !/limit|quota|tomorrow|daily|free ai/i.test(m);
      if (m && !generic) {
        return scrubVendorNamesFromUserMessage(`${m}${quotaSuffix}`);
      }
      return `You've reached today's limit of free AI actions. Try again after the reset (UTC midnight).${quotaSuffix} For higher limits, upgrade your plan.`;
    }

    if (isTransientAiStructuredOutputError(error)) {
      return TRANSIENT_AI_STRUCTURED_OUTPUT_MESSAGE;
    }

    const msg = nested.message?.toLowerCase() ?? '';
    const isServiceUnavailable =
      effectiveStatus === 503 ||
      nested.code === 'Service Unavailable' ||
      (msg.includes('unavailable') &&
        (msg.includes('tempor') || msg.includes('temporary'))) ||
      msg.includes('rate limit') ||
      msg.includes('high demand');

    if (isServiceUnavailable) {
      return userFacingServiceUnavailableMessage(nested.message);
    }

    if (ax.code === 'ERR_NETWORK' || ax.message === 'Network Error') {
      return 'Cannot reach the API. Confirm the backend is running, NEXT_PUBLIC_API_URL matches your Nest base (including /api), and CORS allows this origin.';
    }
    if (data && typeof data === 'object') {
      const d = data as ErrorBody;
      const top = pickMessage(d.message);
      if (top) return scrubVendorNamesFromUserMessage(top);
      if (typeof d.error === 'string')
        return scrubVendorNamesFromUserMessage(d.error);
      if (d.error && typeof d.error === 'object') {
        const nestedMsg = pickMessage(d.error.message);
        if (nestedMsg) return scrubVendorNamesFromUserMessage(nestedMsg);
      }
    }
    if (responseStatus) {
      return `Request failed (${responseStatus})`;
    }
    return scrubVendorNamesFromUserMessage(ax.message || 'Request failed');
  }
  if (error instanceof Error && error.message?.trim()) {
    return error.message.trim();
  }
  return 'Something went wrong';
}

export function getApiErrorMessage(error: unknown): string {
  return stripUserFacingDebugTrailer(getApiErrorMessageBase(error));
}

/** User-facing toast copy with optional API error code for support. */
export function formatApiErrorForToast(
  error: unknown,
  fallback: string,
): string {
  const message = getApiErrorMessage(error) || fallback;
  const code = getApiErrorCode(error);
  if (!code) return message;
  if (message.toUpperCase().includes(code.toUpperCase())) return message;
  return `${message} (${code})`;
}
