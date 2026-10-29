import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { describe, expect, it, vi } from 'vitest';

import {
  acceptRespectingEdits,
  TAILOR_OVERWRITE_EDITS_PROMPT,
} from '@/lib/tailorAcceptEdits';

function conflict(code: string): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('409', 'ERR_BAD_REQUEST', config, undefined, {
    status: 409,
    statusText: 'Conflict',
    headers: {},
    config,
    data: { success: false, error: { code, message: 'edited' } },
  });
}

describe('acceptRespectingEdits', () => {
  it('accepts normally when nothing was edited', async () => {
    const run = vi.fn().mockResolvedValue('ok');
    const confirm = vi.fn();
    await expect(acceptRespectingEdits(run, confirm)).resolves.toBe('ok');
    expect(run).toHaveBeenCalledWith(false);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before replacing edits and retries with overwrite when confirmed', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(conflict('TAILOR_SECTION_CHANGED'))
      .mockResolvedValue('ok');
    const confirm = vi.fn().mockReturnValue(true);
    await expect(acceptRespectingEdits(run, confirm)).resolves.toBe('ok');
    expect(confirm).toHaveBeenCalledWith(TAILOR_OVERWRITE_EDITS_PROMPT);
    expect(run).toHaveBeenLastCalledWith(true);
  });

  it('keeps the edits when the user declines', async () => {
    const run = vi.fn().mockRejectedValue(conflict('TAILOR_SECTION_CHANGED'));
    await expect(acceptRespectingEdits(run, () => false)).resolves.toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('rethrows other errors', async () => {
    const err = conflict('TAILOR_DRAFT_BUSY');
    const run = vi.fn().mockRejectedValue(err);
    await expect(acceptRespectingEdits(run, () => true)).rejects.toBe(err);
  });
});
