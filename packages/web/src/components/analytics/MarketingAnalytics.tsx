'use client';

import { useEffect, useRef } from 'react';

import { captureEvent } from '@/lib/analytics';

/** Fires once per mount on the public landing page. */
export function MarketingAnalytics() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    captureEvent('landing_page_viewed', { surface: 'landing' });
  }, []);
  return null;
}

export function trackMarketingCta(cta: string, location: string): void {
  captureEvent('marketing_cta_clicked', { cta, location });
}
