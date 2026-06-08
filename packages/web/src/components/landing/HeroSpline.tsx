'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode, useCallback, useEffect, useState } from 'react';

const Spline = dynamic(() => import('@splinetool/react-spline'), {
  ssr: false,
  loading: () => null,
});

const SCENE =
  'https://prod.spline.design/Ri5oHxFZ81Bs6GFl/scene.splinecode';

class SplineSceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function HeroSpline() {
  const [loaded, setLoaded] = useState(false);
  const [sceneAvailable, setSceneAvailable] = useState(true);

  const onLoad = useCallback(() => {
    setLoaded(true);
  }, []);

  const onSceneError = useCallback(() => {
    setSceneAvailable(false);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch(SCENE, { method: 'GET', mode: 'cors' })
      .then((res) => {
        if (!cancelled && !res.ok) onSceneError();
      })
      .catch(() => {
        if (!cancelled) onSceneError();
      });
    return () => {
      cancelled = true;
    };
  }, [onSceneError]);

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
      {sceneAvailable ? (
        <div className="absolute inset-0 z-0 h-full w-full bg-black [&_canvas]:h-full [&_canvas]:w-full">
          <SplineSceneBoundary onError={onSceneError}>
            <Spline scene={SCENE} onLoad={onLoad} />
          </SplineSceneBoundary>
        </div>
      ) : null}
      {/* Mute WebGL / scene edge if it clears to non-black */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-[min(22%,140px)] bg-gradient-to-l from-black to-transparent"
        aria-hidden
      />
    </div>
  );
}
