'use client';

import { useEffect, useRef } from 'react';

import { isPublicAuthPath } from '@/lib/authSync';
import {
  clearExtensionTokenIfInstalled,
  handoffExtensionTokenIfInstalled,
} from '@/lib/extensionAuthHandoff';
import { tryRestoreSessionFromApiCookie } from '@/lib/authRefresh';
import { useAuthStore } from '@/store/useAuthStore';

export const APPLYMATE_AUTH_RESTORED_EVENT = 'applymate-auth-restored';

/** Keep extension ↔ web app auth in sync within the same browser. */
export function ExtensionAuthBridge() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const lastHandoff = useRef<string | null>(null);
  const restoreAttempted = useRef(false);
  const wasAuthenticated = useRef(false);

  useEffect(() => {
    if (restoreAttempted.current || isAuthenticated || isPublicAuthPath()) return;
    restoreAttempted.current = true;
    void tryRestoreSessionFromApiCookie();
  }, [isAuthenticated]);

  useEffect(() => {
    const onRestored = () => {
      hydrateFromStorage();
    };
    window.addEventListener(APPLYMATE_AUTH_RESTORED_EVENT, onRestored);
    return () => window.removeEventListener(APPLYMATE_AUTH_RESTORED_EVENT, onRestored);
  }, [hydrateFromStorage]);

  useEffect(() => {
    const token = accessToken?.trim();
    if (!isAuthenticated || !token || lastHandoff.current === token) {
      return;
    }
    lastHandoff.current = token;
    void handoffExtensionTokenIfInstalled(token);
  }, [accessToken, isAuthenticated]);

  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) {
      lastHandoff.current = null;
      void clearExtensionTokenIfInstalled();
    }
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  return null;
}
