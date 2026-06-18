import { NextRequest, NextResponse } from 'next/server';

import {
  BACKEND_TIMEOUT_ERROR_CODE,
  BACKEND_UNREACHABLE_ERROR_CODE,
  DEV_BACKEND_PROXY_TIMEOUT_MS,
  resolveNestApiOrigin,
} from '@/lib/devBackendProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

function forwardRequestHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    headers.set(key, value);
  });
  return headers;
}

function forwardResponseHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower)) return;
    headers.set(key, value);
  });
  return headers;
}

function proxyFailureResponse(code: typeof BACKEND_UNREACHABLE_ERROR_CODE | typeof BACKEND_TIMEOUT_ERROR_CODE): NextResponse {
  const message =
    code === BACKEND_TIMEOUT_ERROR_CODE
      ? 'The API server took too long to respond. Try again, or restart the Nest backend if it is stuck.'
      : 'Cannot reach the API server. Confirm Nest is running (default :3000) and NEXT_PUBLIC_API_URL is correct.';

  return NextResponse.json(
    {
      success: false,
      error: { message, code },
    },
    { status: 502 },
  );
}

async function proxyToNest(req: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join('/');
  const target = `${resolveNestApiOrigin()}/api/${path}${req.nextUrl.search}`;
  const method = req.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  let body: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      body = await req.arrayBuffer();
    } catch {
      return proxyFailureResponse(BACKEND_UNREACHABLE_ERROR_CODE);
    }
  }

  try {
    const upstream = await fetch(target, {
      method,
      headers: forwardRequestHeaders(req),
      body: hasBody ? body : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(DEV_BACKEND_PROXY_TIMEOUT_MS),
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: forwardResponseHeaders(upstream),
    });
  } catch (err) {
    const timedOut =
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError');
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[backend-api] ${method} /${path} → ${timedOut ? 'timeout' : 'unreachable'}`,
      );
    }
    return proxyFailureResponse(
      timedOut ? BACKEND_TIMEOUT_ERROR_CODE : BACKEND_UNREACHABLE_ERROR_CODE,
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { path } = await ctx.params;
  const segments = Array.isArray(path) ? path : [];
  if (segments.length === 0) {
    return NextResponse.json(
      { success: false, error: { message: 'Missing API path', code: 'BAD_PROXY_PATH' } },
      { status: 400 },
    );
  }
  return proxyToNest(req, segments);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
