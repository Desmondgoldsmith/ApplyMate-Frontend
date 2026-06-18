import type { User } from '@/shared/types';

const TOKEN_KEY = 'extensionToken';
const EXPIRES_AT_KEY = 'extensionTokenExpiresAt';
const USER_CACHE_KEY = 'extensionUserCache';

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.session.get(TOKEN_KEY);
  const token = result[TOKEN_KEY];
  return typeof token === 'string' && token.trim() ? token : null;
}

export async function setToken(token: string, expiresAt?: string): Promise<void> {
  const payload: Record<string, string> = { [TOKEN_KEY]: token };
  if (expiresAt?.trim()) {
    payload[EXPIRES_AT_KEY] = expiresAt.trim();
  }
  await chrome.storage.session.set(payload);
}

export async function clearToken(): Promise<void> {
  await chrome.storage.session.remove([TOKEN_KEY, EXPIRES_AT_KEY, USER_CACHE_KEY]);
}

/** Clear draggable icon position saved in local storage. */
export async function clearIconPosition(): Promise<void> {
  await chrome.storage.local.remove(ICON_POS_KEY);
}

export async function getCachedUser(): Promise<User | null> {
  const stored = await chrome.storage.session.get(USER_CACHE_KEY);
  const raw = stored[USER_CACHE_KEY];
  if (typeof raw !== 'string') return null;
  try {
    const user = JSON.parse(raw) as User;
    if (user?.id && user.email) return user;
  } catch {
    /* ignore */
  }
  return null;
}

export async function setCachedUser(user: User): Promise<void> {
  await chrome.storage.session.set({ [USER_CACHE_KEY]: JSON.stringify(user) });
}

const ICON_POS_KEY = 'iconPosition';

export async function getIconPosition(): Promise<{ x: number; y: number } | null> {
  const result = await chrome.storage.local.get(ICON_POS_KEY);
  const pos = result[ICON_POS_KEY];
  if (
    pos &&
    typeof pos === 'object' &&
    typeof (pos as { x?: unknown }).x === 'number' &&
    typeof (pos as { y?: unknown }).y === 'number'
  ) {
    return { x: (pos as { x: number }).x, y: (pos as { y: number }).y };
  }
  return null;
}

export async function setIconPosition(x: number, y: number): Promise<void> {
  await chrome.storage.local.set({ [ICON_POS_KEY]: { x, y } });
}
