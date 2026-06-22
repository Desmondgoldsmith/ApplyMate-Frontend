'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

import { captureEvent } from '@/lib/analytics';
import { api } from '@/lib/api';
import {
  readApplymateRefreshTokenFromCookie,
  readApplymateTokenFromCookie,
} from '@/lib/authCookie';
import { handoffExtensionTokenIfInstalled } from '@/lib/extensionAuthHandoff';
import { parseGoogleOAuthIntent } from '@/lib/google-oauth-intent';
import { useAuthStore } from '@/store/useAuthStore';

async function resolveOnboardingDone(user: {
  onboardingCompleted?: boolean | null;
}): Promise<boolean> {
  let onboardingDone = user.onboardingCompleted === true;
  try {
    const onboardingStatus = await api.onboarding.getStatus();
    onboardingDone = onboardingStatus.completed === true;
  } catch {
    /* fall back to user flag */
  }
  return onboardingDone;
}

function OAuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    hydrateFromStorage();

    const intent = parseGoogleOAuthIntent(searchParams.get('intent'));

    void (async () => {
      const token = readApplymateTokenFromCookie()?.trim();
      if (!token) {
        clearAuth({ skipBroadcast: true });
        const path = intent === 'register' ? '/register' : '/login';
        router.replace(`${path}?error=GoogleSignInFailed`);
        return;
      }
      try {
        const user = await api.users.me();
        const onboardingDone = await resolveOnboardingDone(user);
        setAuth(user, token, readApplymateRefreshTokenFromCookie());
        await handoffExtensionTokenIfInstalled(token);

        if (intent === 'register') {
          captureEvent('auth_register_completed', { provider: 'google' });
        } else {
          captureEvent('auth_login_completed', { provider: 'google' });
        }

        router.replace(onboardingDone ? '/dashboard' : '/onboarding');
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[oauth-complete]', err);
        }
        captureEvent('auth_login_failed', {
          provider: 'google',
          message: 'Failed to load profile after Google sign-in',
        });
        clearAuth({ skipBroadcast: true });
        const path = intent === 'register' ? '/register' : '/login';
        router.replace(`${path}?error=GoogleSignInFailed`);
      }
    })();
  }, [clearAuth, hydrateFromStorage, router, searchParams, setAuth]);

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
