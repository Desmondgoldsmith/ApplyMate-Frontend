'use client';

import { useEffect, useState } from 'react';

/** True when user prefers reduced motion — gate Framer/CSS animations. */
export function useMotionSafe(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduceMotion;
}
