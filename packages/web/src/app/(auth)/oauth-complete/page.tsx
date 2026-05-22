'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { captureEvent } from '@/lib/analytics';
import { api } from '@/lib/api';
import { readApplymateTokenFromCookie } from '@/lib/authCookie';
import { useAuthStore } from '@/store/useAuthStore';

/** Finishes Google OAuth after the server sets `applymate_token` (hydrates user like email login). */
export default function OAuthCompletePage() {
  const router = useRouter();
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const setAuth = useAuthStore((s) => s.setAuth);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    hydrateFromStorage();

    void (async () => {
      const token = readApplymateTokenFromCookie()?.trim();
      if (!token) {
        router.replace('/login?error=GoogleSignInFailed');
        return;
      }
      try {
        const user = await api.users.me();
        setAuth(user, token);
        captureEvent('auth_login_completed', { provider: 'google' });
        if (!user.onboardingCompleted) {
          captureEvent('auth_register_completed', { provider: 'google' });
        }
        router.replace(user.onboardingCompleted ? '/dashboard' : '/onboarding');
      } catch {
        captureEvent('auth_login_failed', {
          provider: 'google',
          message: 'Failed to load profile after Google sign-in',
        });
        router.replace('/login?error=GoogleSignInFailed');
      }
    })();
  }, [hydrateFromStorage, router, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-white/60">
      Completing sign-in…
    </div>
  );
}
