'use client';

import { useLayoutEffect, useState } from 'react';

const QUERY = '(max-width: 1023px)';

export function useIsMaxLg(): boolean {
  const [v, setV] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia(QUERY);
    const sync = () => setV(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return v;
}
