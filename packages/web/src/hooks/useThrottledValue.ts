'use client';

import { useEffect, useRef, useState } from 'react';

/** Throttle high-frequency updates (e.g. STT interim) for parent re-renders. */
export function useThrottledValue<T>(value: T, delayMs: number): T {
  const [throttled, setThrottled] = useState(value);
  const lastCommitted = useRef(value);

  useEffect(() => {
    if (value === lastCommitted.current) return;
    const t = window.setTimeout(() => {
      lastCommitted.current = value;
      setThrottled(value);
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs, value]);

  return throttled;
}
