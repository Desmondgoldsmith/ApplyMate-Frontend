/**
 * AI background queue (BullMQ) support — backend 4.3.
 *
 * When the API runs with `ENABLE_AI_QUEUE=true` (+ `REDIS_URL`), the heavy AI
 * POSTs (job analyze, cover-letter generate, CV detailed score) return
 * immediately with a queued envelope instead of the full result:
 *
 *   { async: true, jobId, type, status: 'queued', message, pollUrl }
 *
 * We then poll `GET /ai-jobs/:jobId` until the job is `completed` (use
 * `result`, which matches the old synchronous body) or `failed`.
 *
 * When the queue is OFF (default), responses are synchronous and these helpers
 * are transparent no-ops — the original response is returned untouched.
 */

import { axiosClient, throwIfApiFailureResponse } from './axios';

/**
 * Dev / test escape hatch: when `NEXT_PUBLIC_AI_WAIT_FOR_RESULT=true`, the
 * affected POSTs send `waitForResult: true` so the backend blocks and returns
 * the full result inline (the legacy behavior), bypassing the queue.
 */
export const AI_QUEUE_WAIT_FOR_RESULT =
  process.env.NEXT_PUBLIC_AI_WAIT_FOR_RESULT === 'true';

/** Body fragment to force synchronous processing; empty unless the dev flag is on. */
export const aiWaitForResultBody: { waitForResult?: true } = AI_QUEUE_WAIT_FOR_RESULT
  ? { waitForResult: true }
  : {};

/** Unwrap the standard `{ success, data }` envelope (mirrors api.ts helper). */
function unwrapEnvelope(raw: unknown): Record<string, unknown> {
  if (raw !== null && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (o.success === true && o.data !== null && typeof o.data === 'object') {
      return o.data as Record<string, unknown>;
    }
  }
  return raw !== null && typeof raw === 'object'
    ? (raw as Record<string, unknown>)
    : {};
}

export type QueuedAiJobInfo = {
  jobId: string;
  /** Friendly "being prepared…" copy from the backend, if provided. */
  message?: string;
};

/**
 * Detect the immediate queued envelope from an analyze/generate/detailed-score
 * POST. Returns `null` on the (default) synchronous path.
 */
export function detectQueuedAiJob(
  rawResponseData: unknown,
): QueuedAiJobInfo | null {
  const data = unwrapEnvelope(rawResponseData);
  if (data.async !== true) return null;
  const jobId = typeof data.jobId === 'string' ? data.jobId.trim() : '';
  if (!jobId) return null;
  return {
    jobId,
    message:
      typeof data.message === 'string' && data.message.trim()
        ? data.message.trim()
        : undefined,
  };
}

/** Thrown when a polled AI job ends in `failed`. */
export class AiBackgroundJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiBackgroundJobError';
  }
}

/**
 * Thrown when the client gives up polling before the job finished. The work is
 * usually still running on the backend — this is a "check back" state, not a
 * hard failure, so callers/UI can treat it more gently than {@link AiBackgroundJobError}.
 */
export class AiBackgroundJobTimeoutError extends AiBackgroundJobError {
  constructor(
    message = 'Your request is still being prepared in the background. Check back in a moment — it will appear here once it is ready.',
  ) {
    super(message);
    this.name = 'AiBackgroundJobTimeoutError';
  }
}

export type PollAiBackgroundJobOptions = {
  signal?: AbortSignal;
  /** Delay between polls (default 2500ms). */
  intervalMs?: number;
  /** Give up after this long (default 120000ms). */
  timeoutMs?: number;
};

const DEFAULT_INTERVAL_MS = 2500;
const DEFAULT_TIMEOUT_MS = 120_000;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Poll `GET /ai-jobs/:jobId` until it completes or fails. Returns the job's
 * `result` (same shape as the old synchronous API body for that operation).
 */
export async function pollAiBackgroundJob(
  jobId: string,
  options: PollAiBackgroundJobOptions = {},
): Promise<unknown> {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const res = await axiosClient.get<unknown>(
      `/ai-jobs/${encodeURIComponent(jobId)}`,
      { signal: options.signal },
    );
    throwIfApiFailureResponse(res.data, res.status);
    const body = unwrapEnvelope(res.data);
    const status = typeof body.status === 'string' ? body.status : '';

    if (status === 'completed') {
      return body.result;
    }
    if (status === 'failed') {
      const msg =
        typeof body.errorMessage === 'string' && body.errorMessage.trim()
          ? body.errorMessage.trim()
          : 'The AI task could not be completed. Please try again.';
      throw new AiBackgroundJobError(msg);
    }
    if (Date.now() >= deadline) {
      throw new AiBackgroundJobTimeoutError();
    }
    await sleep(intervalMs, options.signal);
  }
}

/**
 * Resolve an analyze/generate/detailed-score POST response.
 *
 * - Synchronous path (queue off): returns the original response untouched.
 * - Queued path: polls until done, then returns a synthetic
 *   `{ success: true, data: <result payload> }` envelope so existing
 *   normalizers (which already accept that envelope) work unchanged.
 */
export async function resolveMaybeQueuedAiResponse(
  rawResponseData: unknown,
  options: PollAiBackgroundJobOptions = {},
): Promise<unknown> {
  const queued = detectQueuedAiJob(rawResponseData);
  if (!queued) return rawResponseData;
  const result = await pollAiBackgroundJob(queued.jobId, options);
  // `result` may already be a `{ success, data }` envelope or the bare payload;
  // unwrap one level so the synthetic envelope's `data` is always the payload.
  return { success: true, data: unwrapEnvelope(result) };
}
