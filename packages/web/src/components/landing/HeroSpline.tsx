'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

const Spline = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false,
  loading: () => null,
});

const SCENE =
  'https://prod.spline.design/Ri5oHxFZ81Bs6GFl/scene.splinecode';

export function HeroSpline() {
  const [loaded, setLoaded] = useState(false);
  const onLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const badge = document.querySelector('#logo') as HTMLElement | null;
      if (badge) {
        badge.style.display = 'none';
        window.clearInterval(interval);
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black [&_canvas]:outline-none">
      {!loaded ? (
        <div className="absolute inset-0 z-10 bg-black" aria-hidden />
      ) : null}
      <div className="absolute inset-0 z-0 h-full w-full bg-black [&_canvas]:h-full [&_canvas]:w-full">
        <Spline scene={SCENE} onLoad={onLoad} />
      </div>
      {/* Mute WebGL / scene edge if it clears to non-black */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-[min(22%,140px)] bg-gradient-to-l from-black to-transparent"
        aria-hidden
      />
    </div>
  );
}
