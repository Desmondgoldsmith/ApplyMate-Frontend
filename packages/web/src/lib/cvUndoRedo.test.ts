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

  it('undo twice then redo twice walks back the same way', () => {
    const s = (t: string) => ({ ...base, summary: { text: t } });
    let state = createUndoHistoryState();
    state = pushUndoHistorySnapshot(state, s('A'), 'Edit');
    state = pushUndoHistorySnapshot(state, s('B'), 'Edit');
    const u1 = undoHistoryState(state, s('C'))!;
    const u2 = undoHistoryState(u1.state, u1.restored)!;
    expect([u1.restored.summary.text, u2.restored.summary.text]).toEqual([
      'B',
      'A',
    ]);
    const r1 = redoHistoryState(u2.state, u2.restored)!;
    const r2 = redoHistoryState(r1.state, r1.restored)!;
    expect([r1.restored.summary.text, r2.restored.summary.text]).toEqual([
      'B',
      'C',
    ]);
  });

  it('skips a step that matches what is already on screen', () => {
    const s = (t: string) => ({ ...base, summary: { text: t } });
    let state = pushUndoHistorySnapshot(
      createUndoHistoryState(),
      s('A'),
      'Edit',
    );
    state = {
      ...state,
      past: [
        ...state.past,
        ...pushUndoHistorySnapshot(createUndoHistoryState(), s('B'), 'AI').past,
      ],
    };
    const undone = undoHistoryState(state, s('B'));
    expect(undone?.restored.summary.text).toBe('A');
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
