import { describe, expect, it, vi } from 'vitest';
import { normalizeLinkUrl } from '@/components/cv/CvSelectionFormatBar';
import {
  registerCvPendingEditsSaver,
  savePendingCvEdits,
} from './cvPendingEdits';

describe('savePendingCvEdits', () => {
  it('runs the registered saver and stops after it unregisters', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const unregister = registerCvPendingEditsSaver(save);
    await savePendingCvEdits();
    expect(save).toHaveBeenCalledTimes(1);
    unregister();
    await savePendingCvEdits();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('never blocks the AI action when saving fails', async () => {
    const unregister = registerCvPendingEditsSaver(() =>
      Promise.reject(new Error('offline')),
    );
    await expect(savePendingCvEdits()).resolves.toBeUndefined();
    unregister();
  });
});

describe('normalizeLinkUrl', () => {
  it('adds https:// to bare addresses', () => {
    expect(normalizeLinkUrl('linkedin.com/in/ada')).toBe(
      'https://linkedin.com/in/ada',
    );
    expect(normalizeLinkUrl(' https://ada.dev ')).toBe('https://ada.dev/');
  });

  it('rejects things that are not web addresses', () => {
    expect(normalizeLinkUrl('')).toBeNull();
    expect(normalizeLinkUrl('notaurl')).toBeNull();
    expect(normalizeLinkUrl('javascript:alert(1)')).toBeNull();
  });
});
