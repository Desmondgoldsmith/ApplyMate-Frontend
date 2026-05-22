const CHANNEL_NAME = 'applymate-auth-sync';

function openChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
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
