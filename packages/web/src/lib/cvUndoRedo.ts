import type { CVBuilderData } from '@/lib/cvBuilder';
import { stableStringify } from '@/lib/cvBuilder';

/** One undo step — CV content only; never suggestion-list state. */
export type UndoHistoryEntry = {
  data: CVBuilderData;
  label: string;
  timestamp: number;
};

/** In-memory undo/redo stacks for {@link CVBuilderData} snapshots. */
export type UndoHistoryState = {
  past: UndoHistoryEntry[];
  future: UndoHistoryEntry[];
};

/** @deprecated Use {@link UndoHistoryEntry} */
export type CvUndoEntry = {
  data: CVBuilderData;
  label?: string;
};

/** @deprecated Use {@link UndoHistoryState} */
export type CvUndoStack = UndoHistoryState;

/** Debounce window: rapid edits in one field collapse to a single undo step. */
export const CV_UNDO_COALESCE_MS = 450;

export const MAX_UNDO_STEPS = 40;

export function computeCvUndoFingerprint(data: CVBuilderData): string {
  return stableStringify(data);
}

/** Blur active contenteditable inside the CV preview so pending inline edits commit before undo/redo. */
export function flushCvInlineEdits(): void {
  if (typeof document === 'undefined') return;
  const root = document.querySelector('[data-cv-document-root]');
  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active.isContentEditable &&
    (!root || root.contains(active))
  ) {
    active.blur();
  }
}

function cloneBuilderData(data: CVBuilderData): CVBuilderData {
  return structuredClone(data);
}

function cloneHistoryEntry(data: CVBuilderData, label: string): UndoHistoryEntry {
  return {
    data: cloneBuilderData(data),
    label,
    timestamp: Date.now(),
  };
}

export function createUndoHistoryState(): UndoHistoryState {
  return { past: [], future: [] };
}

/** @deprecated Use {@link createUndoHistoryState} */
export function createCvUndoStack(): UndoHistoryState {
  return createUndoHistoryState();
}

export function shouldSkipUndoHistoryPush(
  past: UndoHistoryEntry[],
  current: CVBuilderData,
): boolean {
  const fp = computeCvUndoFingerprint(current);
  const last = past[past.length - 1];
  return Boolean(last && computeCvUndoFingerprint(last.data) === fp);
}

/**
 * Push a pre-change snapshot onto `past` and clear `future`.
 * Skips when `current` matches the latest past fingerprint (duplicate step).
 */
export function pushUndoHistorySnapshot(
  state: UndoHistoryState,
  current: CVBuilderData,
  label: string,
): UndoHistoryState {
  if (shouldSkipUndoHistoryPush(state.past, current)) {
    return { past: state.past, future: [] };
  }
  const past = [...state.past, cloneHistoryEntry(current, label)].slice(
    -MAX_UNDO_STEPS,
  );
  return { past, future: [] };
}

/** Always push — used before AI accept so undo is guaranteed even when fingerprint matches last step. */
export function pushUndoHistorySnapshotForced(
  state: UndoHistoryState,
  current: CVBuilderData,
  label: string,
): UndoHistoryState {
  const past = [...state.past, cloneHistoryEntry(current, label)].slice(
    -MAX_UNDO_STEPS,
  );
  return { past, future: [] };
}

/** @deprecated Use {@link pushUndoHistorySnapshot} */
export function pushCvUndoEntry(
  stack: UndoHistoryState,
  entry: CvUndoEntry,
): UndoHistoryState {
  return pushUndoHistorySnapshot(stack, entry.data, entry.label ?? 'Edit');
}

/**
 * Undo one step: restore previous {@link CVBuilderData} and push the current
 * state onto `future` so redo can return to it.
 */
export function undoHistoryState(
  state: UndoHistoryState,
  current: CVBuilderData,
): { state: UndoHistoryState; restored: CVBuilderData } | null {
  if (state.past.length === 0) return null;
  const past = [...state.past];
  const entry = past.pop();
  if (!entry) return null;
  const future = [
    cloneHistoryEntry(current, 'Redo point'),
    ...state.future,
  ].slice(-MAX_UNDO_STEPS);
  return {
    state: { past, future },
    restored: cloneBuilderData(entry.data),
  };
}

/**
 * Redo one step: restore next {@link CVBuilderData} and push the current
 * state onto `past`.
 */
export function redoHistoryState(
  state: UndoHistoryState,
  current: CVBuilderData,
): { state: UndoHistoryState; restored: CVBuilderData } | null {
  if (state.future.length === 0) return null;
  const future = [...state.future];
  const entry = future.pop();
  if (!entry) return null;
  const past = [
    ...state.past,
    cloneHistoryEntry(current, 'Undo point'),
  ].slice(-MAX_UNDO_STEPS);
  return {
    state: { past, future },
    restored: cloneBuilderData(entry.data),
  };
}

/** @deprecated Use {@link undoHistoryState} */
export function undoCvStack(stack: UndoHistoryState): {
  stack: UndoHistoryState;
  restored: CvUndoEntry | null;
  current: CvUndoEntry | null;
} {
  const result = undoHistoryState(stack, stack.past[stack.past.length - 1]?.data ?? ({} as CVBuilderData));
  if (!result) {
    return { stack, restored: null, current: null };
  }
  const lastPast = stack.past[stack.past.length - 1];
  return {
    stack: result.state,
    restored: lastPast ?? null,
    current: null,
  };
}

/** @deprecated Use {@link redoHistoryState} */
export function redoCvStack(stack: UndoHistoryState): {
  stack: UndoHistoryState;
  restored: CvUndoEntry | null;
} {
  const anchor = stack.future[stack.future.length - 1]?.data;
  if (!anchor) {
    return { stack, restored: null };
  }
  const result = redoHistoryState(stack, anchor);
  if (!result) {
    return { stack, restored: null };
  }
  const lastFuture = stack.future[stack.future.length - 1];
  return {
    stack: result.state,
    restored: lastFuture ?? null,
  };
}
