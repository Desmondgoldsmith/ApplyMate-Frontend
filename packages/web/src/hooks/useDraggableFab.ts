'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type FabOffset = { x: number; y: number };

const LONG_PRESS_MS = 420;
const DRAG_THRESHOLD_PX = 6;

function readStoredFabOffset(storageKey: string): FabOffset {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return { x: 0, y: 0 };
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== 'object') return { x: 0, y: 0 };
    const x = Number((o as FabOffset).x);
    const y = Number((o as FabOffset).y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
    return { x, y };
  } catch {
    return { x: 0, y: 0 };
  }
}

type DragSession = {
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  dragActive: boolean;
  longPressArmed: boolean;
};

export function useDraggableFab(storageKey: string) {
  const [offset, setOffset] = useState<FabOffset>(() =>
    readStoredFabOffset(storageKey),
  );
  const offsetRef = useRef(offset);
  useLayoutEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const dragRef = useRef<DragSession | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const justDraggedRef = useRef(false);

  const persistOffset = useCallback(
    (next: FabOffset) => {
      setOffset(next);
      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* quota / private mode */
      }
    },
    [storageKey],
  );

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current != null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      justDraggedRef.current = false;
      clearLongPressTimer();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: offsetRef.current.x,
        origY: offsetRef.current.y,
        dragActive: false,
        longPressArmed: false,
      };
      longPressTimerRef.current = setTimeout(() => {
        const d = dragRef.current;
        if (!d) return;
        d.longPressArmed = true;
      }, LONG_PRESS_MS);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [clearLongPressTimer],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const moved =
        Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX;
      if (!d.dragActive && (d.longPressArmed || moved)) {
        d.dragActive = true;
        clearLongPressTimer();
      }
      if (!d.dragActive) return;
      e.preventDefault();
      justDraggedRef.current = true;
      persistOffset({ x: d.origX + dx, y: d.origY + dy });
    },
    [clearLongPressTimer, persistOffset],
  );

  const endPointer = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      clearLongPressTimer();
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [clearLongPressTimer],
  );

  const shouldSuppressClick = useCallback(() => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return true;
    }
    return false;
  }, []);

  return {
    offset,
    onPointerDown,
    onPointerMove,
    onPointerUp: endPointer,
    onPointerCancel: endPointer,
    shouldSuppressClick,
  };
}
