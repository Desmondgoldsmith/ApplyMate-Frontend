'use client';

import { useEffect, useRef } from 'react';

import { captureEvent } from '@/lib/analytics';

type FunnelSurface = 'login' | 'register' | 'onboarding' | 'dashboard';

export function FunnelPageAnalytics({ surface }: { surface: FunnelSurface }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    if (surface === 'login') return;
    if (surface === 'register') return;
    if (surface === 'onboarding') {
      captureEvent('onboarding_entered');
      return;
    }
    if (surface === 'dashboard') {
      captureEvent('dashboard_entered');
    }
  }, [surface]);
  return null;
}
