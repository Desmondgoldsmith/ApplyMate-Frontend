'use client';

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

/** A4 at 96 dpi: the width the PDF export renders at. */
export const A4_WIDTH_PX = 794;

const FIT_MEDIA = '(min-width: 640px)';

function subscribeFitMedia(onChange: () => void) {
  const media = window.matchMedia(FIT_MEDIA);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/**
 * Lays the CV out at true A4 width and scales it to the space available, so line breaks and
 * section positions match the downloaded PDF exactly. Phones keep the flowing layout, where a
 * whole A4 page would be too small to edit.
 */
export function A4FitFrame({ children }: { children: ReactNode }) {
  const fit = useSyncExternalStore(
    subscribeFitMedia,
    () => window.matchMedia(FIT_MEDIA).matches,
    () => true,
  );
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [outerWidth, setOuterWidth] = useState(A4_WIDTH_PX);
  const [innerHeight, setInnerHeight] = useState(0);

  useLayoutEffect(() => {
    if (!fit) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      setOuterWidth(outer.clientWidth);
      setInnerHeight(inner.offsetHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [fit]);

  if (!fit) return <>{children}</>;

  const scale = outerWidth > 0 ? Math.min(1, outerWidth / A4_WIDTH_PX) : 1;
  return (
    <div
      ref={outerRef}
      className="w-full"
      style={{ height: innerHeight ? innerHeight * scale : undefined }}
    >
      <div
        ref={innerRef}
        style={{
          width: A4_WIDTH_PX,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          marginInline: scale < 1 ? undefined : 'auto',
        }}
      >
        {children}
      </div>
    </div>
  );
}
