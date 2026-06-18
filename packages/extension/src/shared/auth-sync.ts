import { authApi } from '@/shared/api';
import { clearToken, setCachedUser, setToken } from '@/shared/storage';
import type { User } from '@/shared/types';
const WEB_APP_ORIGIN = (
  import.meta.env.VITE_WEB_APP_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

const WEB_AUTH_COOKIE = 'applymate_token';
/** After web logout, block re-sync from API refresh cookie briefly. */
let webLogoutAt = 0;
const WEB_LOGOUT_BLOCK_MS = 5 * 60 * 1000;

export function markWebLogout(): void {
  webLogoutAt = Date.now();
}
/** Read the dashboard access token from an open ApplyMate web tab. */
export async function readAccessTokenFromDashboardTabs(): Promise<string | null> {
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({ url: `${WEB_APP_ORIGIN}/*` });
  } catch {
    return null;
  }

  for (const tab of tabs) {
    if (!tab.id) {
      continue;
    }
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (cookieName: string) => {
          const parts = document.cookie.split(';');
          for (const part of parts) {
            const [name, ...rest] = part.trim().split('=');
            if (name === cookieName && rest.length > 0) {
              const raw = rest.join('=').trim();
              if (raw) {
                return decodeURIComponent(raw);
              }
            }
          }
          return null;
        },
        args: [WEB_AUTH_COOKIE],
      });
      const token = injection?.result;
      if (typeof token === 'string' && token.trim()) {
        return token.trim();
      }
    } catch {
      continue;
    }
  }

  return null;
}

export type ExtensionAuthSyncResult =
  | { ok: true; user: User }
  | { ok: false };

/**
 * Sync extension auth from the same browser session as the web app:
 * 1) API refresh cookie via GET /auth/extension/sync
 * 2) Dashboard tab access cookie → mint extension token
 */
function normalizeUser(user: User | undefined): User | null {
  if (!user?.id || !user.email) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
  };
}

let syncInFlight: Promise<ExtensionAuthSyncResult> | null = null;

export async function syncExtensionAuth(): Promise<ExtensionAuthSyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = syncExtensionAuthImpl().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function syncExtensionAuthImpl(): Promise<ExtensionAuthSyncResult> {
  if (Date.now() - webLogoutAt < WEB_LOGOUT_BLOCK_MS) {
    await clearToken();
    return { ok: false };
  }

  try {
    const synced = await authApi.syncFromBrowserSession();
    if (synced.extensionToken) {
      await setToken(synced.extensionToken, synced.expiresAt);
      const user = normalizeUser(synced.user) ?? (await authApi.getMe());
      await setCachedUser(user);
      return { ok: true, user };
    }
  } catch {
    /* try dashboard tab fallback */
  }
  const accessToken = await readAccessTokenFromDashboardTabs();
  if (!accessToken) {
    await clearToken();
    return { ok: false };
  }

  try {
    const minted = await authApi.mintExtensionToken(accessToken);
    await setToken(minted.extensionToken, minted.expiresAt);
    const user = normalizeUser(minted.user) ?? (await authApi.getMe());
    await setCachedUser(user);
    return { ok: true, user };
  } catch {
    await clearToken();
    return { ok: false };
  }
}
