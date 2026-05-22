'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { capturePageView } from '@/lib/analytics';

/** SPA page views for App Router (PostHog capture_pageview is disabled). */
export function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const search = searchParams?.toString() ?? '';
    const key = `${pathname}?${search}`;
    if (lastRef.current === key) return;
    lastRef.current = key;
    capturePageView(pathname, search || undefined);
  }, [pathname, searchParams]);

  return null;
}
