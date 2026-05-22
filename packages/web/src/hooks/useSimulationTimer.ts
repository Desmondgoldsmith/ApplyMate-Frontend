'use client';

import { useEffect, useRef, useState } from 'react';

/** Client-side per-question timer; does not block UI. */
export function useSimulationTimer(
  questionTimeLimitSec: number | undefined,
  active: boolean,
  resetKey: string | number,
) {
  const [elapsed, setElapsed] = useState(0);
  const limit = questionTimeLimitSec && questionTimeLimitSec > 0 ? questionTimeLimitSec : 0;

  useEffect(() => {
    setElapsed(0);
  }, [resetKey]);

  useEffect(() => {
    if (!active || limit <= 0) return;
    const id = window.setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [active, limit, resetKey]);

  const remaining = limit > 0 ? Math.max(0, limit - elapsed) : 0;
  const ratio = limit > 0 ? Math.min(1, elapsed / limit) : 0;
  const isLow = limit > 0 && remaining <= Math.ceil(limit * 0.2);

  return { elapsed, remaining, limit, ratio, isLow, active: active && limit > 0 };
}
