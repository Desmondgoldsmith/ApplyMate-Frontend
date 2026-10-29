import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  api,
  CV_EXPORT_TIMEOUT_MS,
  cvExportBusyRetry,
  type CvExportRequestOpts,
} from '@/lib/api';
import { axiosClient, getApiErrorCode } from '@/lib/axios';
import {
  CV_EXPORT_BUSY_MESSAGE,
  CV_EXPORT_NOT_FOUND_MESSAGE,
  CV_EXPORT_TIMEOUT_MESSAGE,
  getCvExportErrorMessage,
} from '@/lib/cvExportErrors';
import {
  DEV_BACKEND_PROXY_EXPORT_TIMEOUT_MS,
  DEV_BACKEND_PROXY_TIMEOUT_MS,
  devBackendProxyTimeoutMs,
} from '@/lib/devBackendProxy';

type ExportFormat = 'pdf' | 'docx';

const PROFILE_ID = 'profile-1';
const requestConfig = {
  headers: new AxiosHeaders(),
} as InternalAxiosRequestConfig;

function download(
  format: ExportFormat,
  opts: CvExportRequestOpts = { cvProfileId: PROFILE_ID, template: 'modern' },
) {
  return format === 'pdf'
    ? api.cvExport.downloadPdf(opts)
    : api.cvExport.downloadDocx(opts);
}

function okResponse(format: ExportFormat): AxiosResponse<Blob> {
  return {
    data: new Blob(['file-bytes'], { type: `application/${format}` }),
    status: 200,
    statusText: 'OK',
    headers: { 'x-export-filename': `Jane-Doe-CV.${format}` },
    config: requestConfig,
  };
}

/** Mirrors a `responseType: 'blob'` failure: the JSON error envelope arrives as a Blob. */
function httpError(status: number, code?: string): AxiosError {
  const body = code
    ? {
        success: false,
        error: { statusCode: status, message: `Failed (${code})`, code },
      }
    : { success: false, error: { statusCode: status, message: 'Not found' } };
  return new AxiosError(
    `Request failed with status code ${status}`,
    AxiosError.ERR_BAD_RESPONSE,
    requestConfig,
    undefined,
    {
      data: new Blob([JSON.stringify(body)], { type: 'application/json' }),
      status,
      statusText: '',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      config: requestConfig,
    },
  );
}

function clientTimeoutError(): AxiosError {
  return new AxiosError(
    `timeout of ${CV_EXPORT_TIMEOUT_MS}ms exceeded`,
    AxiosError.ECONNABORTED,
    requestConfig,
  );
}

function mockGet() {
  return vi.spyOn(axiosClient, 'get');
}

function requestedPath(spy: ReturnType<typeof mockGet>, call: number): unknown {
  return spy.mock.calls[call]?.[0];
}

function requestedOptions(spy: ReturnType<typeof mockGet>, call: number) {
  return spy.mock.calls[call]?.[1];
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  throw new Error('Expected the export to fail');
}

/** jsdom's Blob lacks `text()` (jsdom#2555); browsers provide it natively. */
let addedBlobText = false;

beforeAll(() => {
  if (typeof Blob.prototype.text === 'function') return;
  addedBlobText = true;
  Blob.prototype.text = function text(this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
});

afterAll(() => {
  if (addedBlobText) {
    delete (Blob.prototype as { text?: unknown }).text;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each<ExportFormat>(['pdf', 'docx'])(
  'cvExport %s download',
  (format) => {
    it('makes exactly one request when the profile-scoped route succeeds', async () => {
      const get = mockGet().mockResolvedValueOnce(okResponse(format));

      const result = await download(format);

      expect(get).toHaveBeenCalledTimes(1);
      expect(requestedPath(get, 0)).toBe(
        `/cv/profiles/${PROFILE_ID}/export/${format}`,
      );
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.filename).toBe(`Jane-Doe-CV.${format}`);
    });

    it('requests with a timeout of at least the 120s backend limit', async () => {
      const get = mockGet().mockResolvedValueOnce(okResponse(format));

      await download(format);

      const timeout = requestedOptions(get, 0)?.timeout;
      expect(timeout).toBeGreaterThanOrEqual(120_000);
      expect(requestedOptions(get, 0)?.responseType).toBe('blob');
    });

    it.each([404, 405])(
      'falls back to the legacy route once on %i',
      async (status) => {
        const get = mockGet()
          .mockRejectedValueOnce(httpError(status))
          .mockResolvedValueOnce(okResponse(format));

        const result = await download(format);

        expect(get).toHaveBeenCalledTimes(2);
        expect(requestedPath(get, 1)).toBe(`/cv/export/${format}`);
        expect(requestedOptions(get, 1)?.params).toMatchObject({
          cvProfileId: PROFILE_ID,
          template: 'modern',
        });
        expect(requestedOptions(get, 1)?.timeout).toBeGreaterThanOrEqual(
          120_000,
        );
        expect(result.blob).toBeInstanceOf(Blob);
      },
    );

    it.each([
      [500, 'INTERNAL_SERVER_ERROR'],
      [504, 'REQUEST_TIMEOUT'],
    ])(
      'does not retry on %i and exposes the parsed code',
      async (status, code) => {
        const get = mockGet().mockRejectedValueOnce(httpError(status, code));

        const err = await rejection(download(format));

        expect(get).toHaveBeenCalledTimes(1);
        expect(err).toBeInstanceOf(AxiosError);
        expect((err as AxiosError).response?.status).toBe(status);
        expect(getApiErrorCode(err)).toBe(code);
      },
    );

    it('does not retry after a client timeout', async () => {
      const timeoutError = clientTimeoutError();
      const get = mockGet().mockRejectedValueOnce(timeoutError);

      const err = await rejection(download(format));

      expect(get).toHaveBeenCalledTimes(1);
      expect(err).toBe(timeoutError);
      expect((err as AxiosError).code).toBe(AxiosError.ECONNABORTED);
    });

    it('uses the legacy route directly when there is no profile id', async () => {
      const get = mockGet().mockResolvedValueOnce(okResponse(format));

      await download(format, { template: 'modern' });

      expect(get).toHaveBeenCalledTimes(1);
      expect(requestedPath(get, 0)).toBe(`/cv/export/${format}`);
      expect(requestedOptions(get, 0)?.timeout).toBeGreaterThanOrEqual(120_000);
    });

    it('sends hidden header fields on the scoped and legacy routes', async () => {
      const get = mockGet()
        .mockRejectedValueOnce(httpError(404))
        .mockResolvedValueOnce(okResponse(format));

      await download(format, {
        cvProfileId: PROFILE_ID,
        hide: ['phone', ' email '],
      });

      expect(requestedOptions(get, 0)?.params).toMatchObject({
        hide: 'phone,email',
      });
      expect(requestedOptions(get, 1)?.params).toMatchObject({
        hide: 'phone,email',
      });
    });

    it('omits hide when nothing is hidden', async () => {
      const get = mockGet().mockResolvedValueOnce(okResponse(format));

      await download(format, {
        cvProfileId: PROFILE_ID,
        template: 'modern',
        hide: [],
      });

      expect(requestedOptions(get, 0)?.params).not.toHaveProperty('hide');
    });

    describe('when the PDF queue is busy', () => {
      const defaultDelay = cvExportBusyRetry.delayMs;
      beforeEach(() => {
        cvExportBusyRetry.delayMs = 0;
      });
      afterEach(() => {
        cvExportBusyRetry.delayMs = defaultDelay;
      });

      it('waits a few seconds by default before retrying', () => {
        expect(defaultDelay).toBeGreaterThanOrEqual(2_000);
      });

      it('retries once and returns the file', async () => {
        const get = mockGet()
          .mockRejectedValueOnce(httpError(503, 'PDF_EXPORT_BUSY'))
          .mockResolvedValueOnce(okResponse(format));

        const result = await download(format);

        expect(get).toHaveBeenCalledTimes(2);
        expect(requestedPath(get, 1)).toBe(
          `/cv/profiles/${PROFILE_ID}/export/${format}`,
        );
        expect(result.blob).toBeInstanceOf(Blob);
      });

      it('gives up after one retry with the busy message', async () => {
        const get = mockGet()
          .mockRejectedValueOnce(httpError(503, 'PDF_EXPORT_BUSY'))
          .mockRejectedValueOnce(httpError(503, 'PDF_EXPORT_BUSY'));

        const err = await rejection(download(format));

        expect(get).toHaveBeenCalledTimes(2);
        expect(getCvExportErrorMessage(err)).toBe(CV_EXPORT_BUSY_MESSAGE);
      });

      it('does not retry other 503s', async () => {
        const get = mockGet().mockRejectedValueOnce(
          httpError(503, 'SERVICE_UNAVAILABLE'),
        );

        await rejection(download(format));

        expect(get).toHaveBeenCalledTimes(1);
      });
    });
  },
);

describe('getCvExportErrorMessage', () => {
  async function parsedError(status: number, code?: string): Promise<unknown> {
    mockGet().mockRejectedValueOnce(httpError(status, code));
    return rejection(api.cvExport.downloadPdf({ cvProfileId: PROFILE_ID }));
  }

  it('shows the slow-PDF message for REQUEST_TIMEOUT (504)', async () => {
    expect(
      getCvExportErrorMessage(await parsedError(504, 'REQUEST_TIMEOUT')),
    ).toBe(CV_EXPORT_TIMEOUT_MESSAGE);
  });

  it('shows the slow-PDF message for a client timeout', () => {
    expect(getCvExportErrorMessage(clientTimeoutError())).toBe(
      CV_EXPORT_TIMEOUT_MESSAGE,
    );
  });

  it('shows the slow-PDF message when the Next proxy times out', async () => {
    expect(
      getCvExportErrorMessage(await parsedError(502, 'BACKEND_TIMEOUT')),
    ).toBe(CV_EXPORT_TIMEOUT_MESSAGE);
  });

  it('shows the not-found message for 403', async () => {
    expect(getCvExportErrorMessage(await parsedError(403, 'FORBIDDEN'))).toBe(
      CV_EXPORT_NOT_FOUND_MESSAGE,
    );
  });

  it('shows the not-found message when the legacy fallback also returns 404', async () => {
    mockGet()
      .mockRejectedValueOnce(httpError(404))
      .mockRejectedValueOnce(httpError(404));
    const err = await rejection(
      api.cvExport.downloadPdf({ cvProfileId: PROFILE_ID }),
    );
    expect(getCvExportErrorMessage(err)).toBe(CV_EXPORT_NOT_FOUND_MESSAGE);
  });

  it('falls back to the server message for other failures', async () => {
    expect(
      getCvExportErrorMessage(await parsedError(500, 'INTERNAL_SERVER_ERROR')),
    ).not.toMatch(/taking longer|couldn't find/i);
  });
});

describe('devBackendProxyTimeoutMs', () => {
  it.each([
    'cv/profiles/abc/export/pdf',
    'cv/profiles/abc/export/docx',
    'cv/export/pdf',
    'cv/export/docx',
  ])('allows %s the export timeout', (path) => {
    expect(devBackendProxyTimeoutMs(path)).toBe(
      DEV_BACKEND_PROXY_EXPORT_TIMEOUT_MS,
    );
  });

  it.each([
    'cv/profiles/abc',
    'jobs/analyze',
    'cv/profiles/abc/export/pdf/extra',
  ])('keeps the default timeout for %s', (path) => {
    expect(devBackendProxyTimeoutMs(path)).toBe(DEV_BACKEND_PROXY_TIMEOUT_MS);
  });
});
