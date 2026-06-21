import { describe, expect, it } from 'vitest';

import { emptyCVBuilderData } from '@/lib/cvBuilder';
import {
  createUndoHistoryState,
  pushUndoHistorySnapshot,
  redoHistoryState,
  undoHistoryState,
} from '@/lib/cvUndoRedo';

describe('cvUndoRedo', () => {
  const base = emptyCVBuilderData({ email: 'a@b.com', name: 'A' });

  it('undo pushes current onto future so redo can restore', () => {
    const s0 = { ...base, summary: { text: '' } };
    const s1 = { ...base, summary: { text: 'AAA' } };
    const s2 = { ...base, summary: { text: 'BBB' } };

    let state = createUndoHistoryState();
    state = pushUndoHistorySnapshot(state, s0, 'Edit');
    state = pushUndoHistorySnapshot(state, s1, 'AI Accept');

    const undo1 = undoHistoryState(state, s2);
    expect(undo1?.restored.summary.text).toBe('AAA');
    expect(undo1?.state.future.length).toBe(1);

    const redo1 = redoHistoryState(undo1!.state, undo1!.restored);
    expect(redo1?.restored.summary.text).toBe('BBB');
    expect(redo1?.state.future.length).toBe(0);
  });

  it('new edit clears redo future', () => {
    const s0 = { ...base, summary: { text: '' } };
    const s1 = { ...base, summary: { text: 'AAA' } };
    let state = pushUndoHistorySnapshot(createUndoHistoryState(), s0, 'Edit');
    const undone = undoHistoryState(state, s1);
    expect(undone?.state.future.length).toBe(1);
    state = pushUndoHistorySnapshot(undone!.state, undone!.restored, 'Edit');
    expect(state.future.length).toBe(0);
  });
});
