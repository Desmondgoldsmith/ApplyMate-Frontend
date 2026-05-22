/**
 * Typed helpers around `chrome.storage` for auth tokens and lightweight prefs.
 * Do not store long-lived secrets without encryption; prefer httpOnly cookies on the web app where possible.
 */

const AUTH_KEY = 'applymate:authToken';

export async function getAuthToken(): Promise<string | undefined> {
  const data = await chrome.storage.local.get(AUTH_KEY);
  return data[AUTH_KEY] as string | undefined;
}

export async function setAuthToken(token: string | null): Promise<void> {
  if (token) {
    await chrome.storage.local.set({ [AUTH_KEY]: token });
  } else {
    await chrome.storage.local.remove(AUTH_KEY);
  }
}
