'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { useToast } from '@/components/ui/Toast';
import { captureEvent } from '@/lib/analytics';
import { googleOAuthErrorToastMessage } from '@/lib/google-auth-errors';

/** Shows a toast when redirected to `/login?error=…` or `/register?error=…` after Google OAuth failures. */
export function useGoogleOAuthErrorToast(): void {
  const searchParams = useSearchParams();
  const pathname = usePathname();
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

    const page = pathname.startsWith('/register') ? 'register' : 'login';
    const message = googleOAuthErrorToastMessage(err, reason, page);
    if (!message) return;

    captureEvent('auth_login_failed', {
      provider: 'google',
      message,
      code: err,
      reason: reason ?? undefined,
    });
    toast.error(message);
    const base = pathname.startsWith('/register') ? '/register' : '/login';
    router.replace(base, { scroll: false });
  }, [pathname, router, searchParams, toast]);
}
