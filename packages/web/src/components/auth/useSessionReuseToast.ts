'use client';

import { useEffect, useRef } from 'react';

import { useToast } from '@/components/ui/Toast';
import { REFRESH_TOKEN_REUSE_SESSION_KEY } from '@/lib/authRefresh';

/** Shows a one-time toast after forced logout from refresh-token reuse detection. */
export function useSessionReuseToast() {
  const toast = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem(REFRESH_TOKEN_REUSE_SESSION_KEY) !== 'reuse') return;
      sessionStorage.removeItem(REFRESH_TOKEN_REUSE_SESSION_KEY);
    } catch {
      return;
    }
    shown.current = true;
    toast.info(
      'Your session was signed out for security. Please sign in again.',
    );
  }, [toast]);
}
