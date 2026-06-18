import { useCallback, useEffect, useState } from 'react';

import { isExtensionContextValid, safeRuntimeSendMessage } from '@/shared/extension-runtime';
import type { GetAuthStateResponse, MessageAction, User } from '@/shared/types';

import { AuthView } from './components/AuthView';
import { MainView } from './components/MainView';

type AppStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function App() {
  const [status, setStatus] = useState<AppStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  const applyAuth = useCallback((response: GetAuthStateResponse | undefined) => {
    if (response?.isAuthenticated && response.user) {
      setUser(response.user);
      setStatus('authenticated');
      return true;
    }
    setUser(null);
    setStatus('unauthenticated');
    return false;
  }, []);

  const refreshAuth = useCallback(async () => {
    if (!isExtensionContextValid()) {
      setUser(null);
      setStatus('unauthenticated');
      return;
    }
    try {
      const cached = (await safeRuntimeSendMessage({
        action: 'getAuthState',
      } satisfies MessageAction)) as GetAuthStateResponse | undefined;

      if (applyAuth(cached)) {
        void safeRuntimeSendMessage({ action: 'syncAuth' } satisfies MessageAction)
          .then((synced) => {
            const response = synced as GetAuthStateResponse | undefined;
            if (response?.isAuthenticated && response.user) {
              applyAuth(response);
            }
          })
          .catch(() => {
            /* keep cached session */
          });
        return;
      }

      setStatus('loading');
      const synced = (await safeRuntimeSendMessage({
        action: 'syncAuth',
      } satisfies MessageAction)) as GetAuthStateResponse | undefined;
      applyAuth(synced);
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [applyAuth]);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (!isExtensionContextValid()) return;
    const onMessage = (message: MessageAction) => {
      if (message?.action === 'unauthorized') {
        setUser(null);
        setStatus('unauthenticated');
      }
      if (message?.action === 'authUpdated') {
        void refreshAuth();
      }
    };
    chrome.runtime.onMessage.addListener(onMessage);
    return () => chrome.runtime.onMessage.removeListener(onMessage);
  }, [refreshAuth]);

  if (status === 'loading') {
    return (
      <div className="flex h-full min-h-screen items-center justify-center bg-am-bg">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-am-primary/25 border-t-am-primary"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (status === 'authenticated' && user) {
    return <MainView user={user} />;
  }

  return <AuthView onRefresh={refreshAuth} />;
}
