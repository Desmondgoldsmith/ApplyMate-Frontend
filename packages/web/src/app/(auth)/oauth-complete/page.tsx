'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

import { captureEvent } from '@/lib/analytics';
import { api } from '@/lib/api';
import { readApplymateTokenFromCookie } from '@/lib/authCookie';
import { parseGoogleOAuthIntent } from '@/lib/google-oauth-intent';
import { useAuthStore } from '@/store/useAuthStore';

function OAuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const setAuth = useAuthStore((s) => s.setAuth);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    hydrateFromStorage();

    const intent = parseGoogleOAuthIntent(searchParams.get('intent'));

    void (async () => {
      const token = readApplymateTokenFromCookie()?.trim();
      if (!token) {
        const path = intent === 'register' ? '/register' : '/login';
        router.replace(`${path}?error=GoogleSignInFailed`);
        return;
      }
      try {
        const user = await api.users.me();
        let onboardingDone = user.onboardingCompleted === true;
        try {
          const onboardingStatus = await api.onboarding.getStatus();
          onboardingDone = onboardingStatus.completed === true;
        } catch {
          /* fall back to user flag */
        }
        setAuth(user, token);

        if (intent === 'register') {
          captureEvent('auth_register_completed', { provider: 'google' });
        } else {
          captureEvent('auth_login_completed', { provider: 'google' });
        }

        router.replace(onboardingDone ? '/dashboard' : '/onboarding');
      } catch {
        captureEvent('auth_login_failed', {
          provider: 'google',
          message: 'Failed to load profile after Google sign-in',
        });
        const path = intent === 'register' ? '/register' : '/login';
        router.replace(`${path}?error=GoogleSignInFailed`);
      }
    })();
  }, [hydrateFromStorage, router, searchParams, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-white/60">
      Completing sign-in…
    </div>
  );
}

/** Finishes Google OAuth after the server sets `applymate_token` (hydrates user like email login). */
export default function OAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-white/60">
          Completing sign-in…
        </div>
      }
    >
      <OAuthCompleteContent />
    </Suspense>
  );
}
