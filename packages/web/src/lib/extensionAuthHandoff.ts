type ChromeRuntime = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback?: () => void,
  ) => void;
  lastError?: { message?: string };
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: { message?: string } | null;
};

const EXTENSION_ID_SESSION_KEY = 'applymate:extension-id';

function resolveExtensionId(): string | null {
  const fromEnv = process.env.NEXT_PUBLIC_EXTENSION_ID?.trim();
  if (fromEnv) return fromEnv;
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(EXTENSION_ID_SESSION_KEY)?.trim() || null;
  } catch {
    return null;
  }
}

export function rememberExtensionId(extensionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(EXTENSION_ID_SESSION_KEY, extensionId.trim());
  } catch {
    /* ignore */
  }
}

export function forgetExtensionId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(EXTENSION_ID_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function readChromeRuntime(): ChromeRuntime | null {
  if (typeof window === 'undefined') return null;
  const runtime = (window as Window & { chrome?: { runtime?: ChromeRuntime } }).chrome
    ?.runtime;
  return runtime ?? null;
}

/** After web login, mint and pass extension JWT when ?source=extension. */
export async function handoffExtensionTokenIfRequested(
  accessToken: string,
): Promise<void> {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  if (params.get('source') !== 'extension') return;

  await handoffExtensionTokenIfInstalled(accessToken);
}

/** Clear extension auth when the web app session ends. */
export async function clearExtensionTokenIfInstalled(): Promise<void> {
  if (typeof window === 'undefined') return;

  const extensionId = resolveExtensionId();
  if (!extensionId) return;

  const runtime = readChromeRuntime();
  if (!runtime) return;

  try {
    await new Promise<void>((resolve) => {
      runtime.sendMessage(extensionId, { action: 'clearToken' }, () => {
        resolve();
      });
    });
    forgetExtensionId();
  } catch {
    /* extension may be unavailable */
  }
}

/** Push extension token when the web app is open and extension id is configured. */
export async function handoffExtensionTokenIfInstalled(
  accessToken: string,
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const extensionId = resolveExtensionId();
  if (!extensionId) return false;

  const runtime = readChromeRuntime();
  if (!runtime) return false;

  try {
    const apiBase = (
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/'
    ).replace(/\/$/, '');

    const res = await fetch(`${apiBase}/auth/extension-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const body = (await res.json()) as ApiEnvelope<{
      extensionToken: string;
      expiresAt: string;
    }>;

    if (!res.ok || !body.success || !body.data?.extensionToken) return false;

    await new Promise<void>((resolve, reject) => {
      runtime.sendMessage(
        extensionId,
        {
          action: 'setToken',
          token: body.data.extensionToken,
          expiresAt: body.data.expiresAt,
        },
        () => {
          if (runtime.lastError?.message) reject(new Error(runtime.lastError.message));
          else resolve();
        },
      );
    });
    rememberExtensionId(extensionId);
    return true;
  } catch {
    return false;
  }
}
