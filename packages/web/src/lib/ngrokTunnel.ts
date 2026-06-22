/** ngrok free tier serves an HTML interstitial unless this header is sent (ERR_NGROK_6024). */
export const NGROK_SKIP_BROWSER_WARNING_HEADER = 'ngrok-skip-browser-warning';

export function isNgrokFreeTunnel(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl, 'http://localhost').hostname.toLowerCase();
    return host.endsWith('.ngrok-free.app') || host.endsWith('.ngrok-free.dev');
  } catch {
    return false;
  }
}

/**
 * Whether to add `ngrok-skip-browser-warning` on API requests.
 * Production + real API host → never. Vercel + ngrok → set `NEXT_PUBLIC_USE_NGROK_TUNNEL=true`.
 */
export function shouldSendNgrokSkipHeader(apiBaseUrl?: string): boolean {
  const base = (apiBaseUrl ?? process.env.NEXT_PUBLIC_API_URL ?? '').trim();
  if (!base || !isNgrokFreeTunnel(base)) return false;

  const flag = process.env.NEXT_PUBLIC_USE_NGROK_TUNNEL?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;

  return process.env.NODE_ENV !== 'production';
}

/** For `fetch()` (server routes, etc.). */
export function ngrokSkipHeaders(
  existing?: HeadersInit,
  apiBaseUrl?: string,
): Headers {
  const headers = new Headers(existing);
  if (shouldSendNgrokSkipHeader(apiBaseUrl)) {
    headers.set(NGROK_SKIP_BROWSER_WARNING_HEADER, 'true');
  }
  return headers;
}

type AxiosLikeHeaders = {
  set?: (name: string, value: string) => void;
  [key: string]: unknown;
};

/** For shared `axiosClient` request interceptor. */
export function applyNgrokSkipHeaders(
  config: { headers?: AxiosLikeHeaders; baseURL?: string },
  apiBaseUrl?: string,
): void {
  const configuredApi = process.env.NEXT_PUBLIC_API_URL?.trim() ?? '';
  const base = config.baseURL ?? apiBaseUrl ?? configuredApi;
  // Dev browser uses `/backend-api/` — check the real upstream URL for ngrok.
  const ngrokCheckTarget =
    configuredApi && isNgrokFreeTunnel(configuredApi) ? configuredApi : base;
  if (!shouldSendNgrokSkipHeader(ngrokCheckTarget)) return;

  if (!config.headers) {
    config.headers = {};
  }
  const headers = config.headers;
  if (typeof headers.set === 'function') {
    headers.set(NGROK_SKIP_BROWSER_WARNING_HEADER, 'true');
    return;
  }
  headers[NGROK_SKIP_BROWSER_WARNING_HEADER] = 'true';
}
