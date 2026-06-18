import { readAccessTokenFromDashboardTabs } from '@/shared/auth-sync';

const WEB_APP_ORIGIN = (
  import.meta.env.VITE_WEB_APP_URL ?? 'http://localhost:3001'
).replace(/\/$/, '');

export const APPLYMATE_AUTH_RESTORED_EVENT = 'applymate-auth-restored';

/** Push a fresh web access token to open dashboard tabs (extension ↔ app session parity). */
export async function syncWebSessionToDashboardTabs(): Promise<void> {
  const accessToken = await readAccessTokenFromDashboardTabs();
  if (!accessToken) {
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
          eventName: string,
          authCookie: string,
        ) => {
          document.cookie = `${authCookie}=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
          window.dispatchEvent(new CustomEvent(eventName));
        },
        args: [accessToken, APPLYMATE_AUTH_RESTORED_EVENT, 'applymate_token'],
      });
    } catch {
      continue;
    }
  }
}
