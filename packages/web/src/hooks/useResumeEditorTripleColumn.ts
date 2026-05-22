'use client';

import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { CVBuilderTripleColumnConfig } from '@/components/cv/CVBuilder';

/**
 * Same resize/collapse behaviour as CV clinic (`dashboard/cv/page.tsx`) for triple-column `CVBuilder`.
 */
export function useResumeEditorTripleColumn(): {
  tripleColumn: CVBuilderTripleColumnConfig;
  containerRef: RefObject<HTMLDivElement | null>;
} {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rightPct, setRightPct] = useState(26);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const onToggleRightCollapsed = useCallback(() => {
    setRightCollapsed((c) => !c);
  }, []);

  const onRightResizePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startPct = rightPct;
      const totalW = containerRef.current?.offsetWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);

      const onMove = (ev: PointerEvent) => {
        const delta = ((startX - ev.clientX) / totalW) * 100;
        setRightPct(Math.min(36, Math.max(18, startPct + delta)));
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [rightPct],
  );

  const tripleColumn = useMemo(
    (): CVBuilderTripleColumnConfig => ({
      containerRef,
      rightPct,
      rightCollapsed,
      onToggleRightCollapsed,
      onRightResizePointerDown,
      centerHeaderActions: null,
    }),
    [rightCollapsed, onRightResizePointerDown, onToggleRightCollapsed, rightPct],
  );

  return { tripleColumn, containerRef };
}
