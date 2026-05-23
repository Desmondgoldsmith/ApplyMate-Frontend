'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useToast } from '@/components/ui/Toast';
import { captureEvent } from '@/lib/analytics';
import { googleOAuthErrorToastMessage } from '@/lib/google-auth-errors';

/** Shows a toast when redirected to `/login?error=…` after Google OAuth failures, then clears the query. */
export function useGoogleOAuthErrorToast(): void {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const err = searchParams.get('error');
    if (!err) return;
    const reason = searchParams.get('errorReason');
    const key = `${err}:${reason ?? ''}`;
    if (handled.current === key) return;
    handled.current = key;

    const message = googleOAuthErrorToastMessage(err, reason);
    if (!message) return;

    captureEvent('auth_login_failed', {
      provider: 'google',
      message,
      code: err,
      reason: reason ?? undefined,
    });
    toast.error(message);
    router.replace('/login', { scroll: false });
  }, [router, searchParams, toast]);
}
