'use client';

import { useEffect, useState } from 'react';

/** True when the primary input supports hover tooltips (mouse/trackpad). */
export function usePrefersFinePointer(): boolean {
  const [fine, setFine] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setFine(true);
      return;
    }
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return fine;
}
