import axios from 'axios';

function formatAxiosResponseBody(data: unknown): string {
  if (data == null) return '(no body)';
  if (typeof data === 'string') return data.slice(0, 2000);
  if (typeof data === 'object' && !Array.isArray(data) && Object.keys(data as object).length === 0) {
    return '(empty JSON object — gateway or Nest may have stripped the body; check Network tab for raw response)';
  }
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

/** Logs failed CV mutation payloads in development only. */
export function logCvMutationErrorDev(scope: string, error: unknown): void {
  if (process.env.NODE_ENV === 'production') return;
  if (!axios.isAxiosError(error)) {
    // eslint-disable-next-line no-console -- dev-only diagnostics (avoid console.error: Next dev overlay)
    console.warn(`[${scope}]`, error);
    return;
  }
  const url = error.config?.url ?? error.config?.baseURL;
  const method = error.config?.method;
  const status = error.response?.status;
  const body = formatAxiosResponseBody(error.response?.data);
  // eslint-disable-next-line no-console -- dev-only diagnostics (avoid console.error: Next dev overlay)
  console.warn(`[${scope}]`, method?.toUpperCase(), url, status, body, '|', error.message);
}
