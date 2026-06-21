'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import type { CVBuilderData } from '@/lib/cvBuilder';
import {
  createUndoHistoryState,
  pushUndoHistorySnapshot,
  pushUndoHistorySnapshotForced,
  redoHistoryState,
  undoHistoryState,
  type UndoHistoryState,
} from '@/lib/cvUndoRedo';

export type { UndoHistoryEntry, UndoHistoryState } from '@/lib/cvUndoRedo';

/** @deprecated Use {@link UndoHistoryEntry} from `@/lib/cvUndoRedo` */
export type CvUndoEntry = {
  data: CVBuilderData;
  label?: string;
};

/**
 * CV content undo/redo — ONE stack of {@link CVBuilderData} snapshots only.
 * Does not touch suggestions, React Query, or any derived UI state.
 */
export function useCvUndoRedo() {
  const historyRef = useRef<UndoHistoryState>(createUndoHistoryState());
  const [stackVersion, setStackVersion] = useState(0);

  const sync = useCallback(() => setStackVersion((v) => v + 1), []);

  const pushBeforeChange = useCallback(
    (current: CVBuilderData, label = 'Edit') => {
      historyRef.current = pushUndoHistorySnapshot(
        historyRef.current,
        current,
        label,
      );
      sync();
    },
    [sync],
  );

  const pushSnapshot = useCallback(
    (current: CVBuilderData, label?: string) => {
      pushBeforeChange(current, label ?? 'Edit');
    },
    [pushBeforeChange],
  );

  const pushSnapshotForced = useCallback(
    (current: CVBuilderData, label?: string) => {
      historyRef.current = pushUndoHistorySnapshotForced(
        historyRef.current,
        current,
        label ?? 'Edit',
      );
      sync();
    },
    [sync],
  );

  const undo = useCallback(
    (current: CVBuilderData): CVBuilderData | null => {
      const result = undoHistoryState(historyRef.current, current);
      if (!result) return null;
      historyRef.current = result.state;
      sync();
      return result.restored;
    },
    [sync],
  );

  const redo = useCallback(
    (current: CVBuilderData): CVBuilderData | null => {
      const result = redoHistoryState(historyRef.current, current);
      if (!result) return null;
      historyRef.current = result.state;
      sync();
      return result.restored;
    },
    [sync],
  );

  const reset = useCallback(() => {
    historyRef.current = createUndoHistoryState();
    sync();
  }, [sync]);

  const canUndo = useMemo(
    () => historyRef.current.past.length > 0,
    [stackVersion],
  );
  const canRedo = useMemo(
    () => historyRef.current.future.length > 0,
    [stackVersion],
  );

  return {
    canUndo,
    canRedo,
    pushBeforeChange,
    pushSnapshot,
    pushSnapshotForced,
    undo,
    redo,
    reset,
  };
}
