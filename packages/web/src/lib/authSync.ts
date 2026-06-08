const CHANNEL_NAME = 'applymate-auth-sync';

function openChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

/** Paths where we should not silently restore a session from API refresh cookies. */
export function isPublicAuthPath(pathname?: string): boolean {
  const path =
    pathname ??
    (typeof window !== 'undefined' ? window.location.pathname : '');
  return path === '/login' || path === '/register' || path === '/oauth-complete';
}

/** Notify other tabs that the session ended (logout or forced clear). */
export function broadcastAuthLogout(): void {
  const ch = openChannel();
  if (!ch) return;
  try {
    ch.postMessage({ type: 'logout', t: Date.now() });
  } finally {
    ch.close();
  }
}

/** Notify other tabs that access/refresh cookies were rotated in this tab. */
export function broadcastAuthTokensUpdated(): void {
  const ch = openChannel();
  if (!ch) return;
  try {
    ch.postMessage({ type: 'tokens-updated', t: Date.now() });
  } finally {
    ch.close();
  }
}

export type AuthSyncUnsubscribe = () => void;

/**
 * Subscribe to cross-tab logout. Caller should run session cleanup + redirect when appropriate.
 * Uses BroadcastChannel when available.
 */
export function subscribeAuthLogout(onLogout: () => void): AuthSyncUnsubscribe {
  if (typeof window === 'undefined') return () => {};

  const ch = openChannel();
  if (!ch) return () => {};

  ch.onmessage = (ev: MessageEvent) => {
    const d = ev.data as { type?: string } | undefined;
    if (d?.type === 'logout') onLogout();
  };

  return () => {
    ch.onmessage = null;
    ch.close();
  };
}

export function subscribeAuthTokensUpdated(onUpdate: () => void): AuthSyncUnsubscribe {
  if (typeof window === 'undefined') return () => {};

  const ch = openChannel();
  if (!ch) return () => {};

  ch.onmessage = (ev: MessageEvent) => {
    const d = ev.data as { type?: string } | undefined;
    if (d?.type === 'tokens-updated') onUpdate();
  };

  return () => {
    ch.onmessage = null;
    ch.close();
  };
}
