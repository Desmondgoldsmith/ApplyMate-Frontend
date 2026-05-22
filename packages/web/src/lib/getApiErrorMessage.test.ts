import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';

import {
  getApiErrorCode,
  getApiErrorMessage,
  isCvAssistantCommitRejectedForFactuality,
  readCvImprovementInvalidFieldSelectionDetails,
} from '@/lib/axios';

function makeAxiosError<T>(params: {
  status?: number;
  data?: T;
  code?: string;
  message?: string;
  url?: string;
  headers?: Record<string, string>;
}): AxiosError<T> {
  const cfg = { url: params.url ?? '/cv/parse' } as InternalAxiosRequestConfig;
  return new AxiosError(
    params.message ?? 'fail',
    params.code,
    cfg,
    undefined,
    {
      status: params.status ?? 500,
      data: params.data as T,
      statusText: 'Error',
      headers: params.headers ?? {},
      config: cfg,
    },
  );
}

describe('getApiErrorMessage', () => {
  it('maps RATE_LIMITED with retry hint', () => {
    const e = makeAxiosError({
      status: 429,
      url: '/cv/parse',
      data: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many', retryAfterSeconds: 120 },
      },
    });
    expect(getApiErrorMessage(e)).toMatch(/Too many requests/i);
  });

  it('maps stale draft codes', () => {
    const e = makeAxiosError({
      status: 409,
      data: { success: false, error: { code: 'IMPROVEMENT_STALE_DRAFT', message: 'stale' } },
    });
    expect(getApiErrorMessage(e)).toMatch(/no longer matches your CV/i);
  });

  it('maps 422 validation', () => {
    const e = makeAxiosError({
      status: 422,
      data: { success: false, error: { message: 'Invalid headline' } },
    });
    expect(getApiErrorMessage(e)).toMatch(/validate/i);
  });

  it('maps client timeout', () => {
    const e = makeAxiosError({ status: undefined, code: 'ECONNABORTED', message: 'timeout of 0ms exceeded' });
    expect(getApiErrorMessage(e)).toMatch(/timed out/i);
  });

  it('maps assistant commit 422 factuality rejection (Phase 2 CV)', () => {
    const e = makeAxiosError({
      status: 422,
      url: '/cv/profiles/p1/assistant/commit',
      data: {
        success: false,
        error: { code: 'CV_ASSISTANT_COMMIT_REJECTED_FACTUALITY', message: 'Rejected' },
      },
    });
    const msg = getApiErrorMessage(e);
    expect(msg).toContain("This change couldn't be applied");
    expect(msg).toContain("isn't supported by what's saved on your CV");
    expect(isCvAssistantCommitRejectedForFactuality(e)).toBe(true);
  });

  it('appends first truthfulness warning for assistant commit factuality 422', () => {
    const e = makeAxiosError({
      status: 422,
      url: '/cv/profiles/p1/assistant/commit',
      data: {
        success: false,
        error: {
          code: 'CV_ASSISTANT_COMMIT_REJECTED_FACTUALITY',
          truthfulnessWarnings: ['Employer names cannot be invented.'],
        },
      },
    });
    expect(getApiErrorMessage(e)).toMatch(/Employer names cannot be invented/i);
  });

  it('isCvAssistantCommitRejectedForFactuality is false for other 422s', () => {
    const e = makeAxiosError({
      status: 422,
      data: { success: false, error: { message: 'Invalid headline' } },
    });
    expect(isCvAssistantCommitRejectedForFactuality(e)).toBe(false);
  });

  it('maps daily AI quota exhaustion with upgrade hint', () => {
    const e = makeAxiosError({
      status: 429,
      url: '/cv/score/detailed',
      data: {
        success: false,
        error: { code: 'DAILY_AI_LIMIT_REACHED' },
      },
    });
    const msg = getApiErrorMessage(e);
    expect(msg).toMatch(/today's limit of free AI actions/i);
    expect(msg).toMatch(/upgrade your plan/i);
  });

  it('getApiErrorCode reads nested improvement codes like getApiErrorMessage', () => {
    const e = makeAxiosError({
      status: 409,
      data: { success: false, error: { code: 'IMPROVEMENT_INVALID_FIELD_SELECTION', message: 'bad fields' } },
    });
    expect(getApiErrorCode(e)).toBe('IMPROVEMENT_INVALID_FIELD_SELECTION');
  });

  it('readCvImprovementInvalidFieldSelectionDetails reads Nest details envelope', () => {
    const e = makeAxiosError({
      status: 409,
      data: {
        statusCode: 409,
        code: 'IMPROVEMENT_INVALID_FIELD_SELECTION',
        message: 'Invalid',
        details: {
          receivedFields: ['x'],
          expectedSelectableKeys: ['a', 'b'],
          pointer: 'sug-1',
          resolvedIndex: 2,
        },
      },
    });
    const d = readCvImprovementInvalidFieldSelectionDetails(e);
    expect(d).toEqual({
      receivedFields: ['x'],
      expectedSelectableKeys: ['a', 'b'],
      pointer: 'sug-1',
      resolvedIndex: 2,
    });
  });

  it('maps IMPROVEMENT_INVALID_FIELD_SELECTION with selectable keys hint', () => {
    const e = makeAxiosError({
      status: 409,
      url: '/cv/improvements/x/accept',
      data: {
        statusCode: 409,
        code: 'IMPROVEMENT_INVALID_FIELD_SELECTION',
        message: 'Invalid',
        details: { expectedSelectableKeys: ['summary.text', 'experience.items.0.title'] },
      },
    });
    expect(getApiErrorMessage(e)).toMatch(/field selection/i);
    expect(getApiErrorMessage(e)).toMatch(/summary\.text/);
  });
});
