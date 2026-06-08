const WEB_APP_ORIGIN = (
  import.meta.env.VITE_WEB_APP_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(
  /\/$/,
  '',
);

export const APPLYMATE_AUTH_RESTORED_EVENT = 'applymate-auth-restored';

type RefreshEnvelope = {
  success: boolean;
  data?: {
    accessToken?: string;
    refreshToken?: string;
  };
};

/** Push a fresh web access token to open dashboard tabs (extension ↔ app session parity). */
export async function syncWebSessionToDashboardTabs(): Promise<void> {
  let accessToken: string;
  let refreshToken: string | null = null;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = (await res.json()) as RefreshEnvelope;
    if (!res.ok || !body.success || !body.data?.accessToken?.trim()) {
      return;
    }
    accessToken = body.data.accessToken.trim();
    refreshToken = body.data.refreshToken?.trim() ?? null;
  } catch {
    return;
  }

  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({ url: `${WEB_APP_ORIGIN}/*` });
  } catch {
    return;
  }

  for (const tab of tabs) {
    if (!tab.id) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (
          token: string,
          refresh: string | null,
          eventName: string,
          authCookie: string,
          refreshCookie: string,
        ) => {
          document.cookie = `${authCookie}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
          if (refresh) {
            document.cookie = `${refreshCookie}=${encodeURIComponent(refresh)}; path=/; SameSite=Lax`;
          }
          window.dispatchEvent(new CustomEvent(eventName));
        },
        args: [
          accessToken,
          refreshToken,
          APPLYMATE_AUTH_RESTORED_EVENT,
          'applymate_token',
          'applymate_refresh_token',
        ],
      });
    } catch {
      continue;
    }
  }
}
