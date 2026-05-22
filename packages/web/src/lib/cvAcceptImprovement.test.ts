import { beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api';
import { axiosClient } from '@/lib/axios';

describe('api.cv.acceptImprovement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POSTs to /cv/improvements/:pointer/accept', async () => {
    const post = vi.spyOn(axiosClient, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          partial: false,
          draftHash: null,
          remainingChangedFields: [],
          appliedChangedFields: ['a.b'],
          improvementId: null,
        },
      },
    });

    const result = await api.cv.acceptImprovement('ptr-99', 'prof-1', {
      acceptedFields: ['summary.headline'],
      draftHash: 'hash',
    });

    expect(post).toHaveBeenCalled();
    const url = post.mock.calls[0]?.[0] as string;
    expect(url).toContain('/cv/improvements/');
    expect(url).toContain('ptr-99');
    expect(url).toContain('/accept');

    expect(result.partial).toBe(false);
    expect(result.appliedChangedFields).toContain('a.b');
  });

  it('trims and drops blank acceptedFields entries in request body', async () => {
    const post = vi.spyOn(axiosClient, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          partial: false,
          draftHash: null,
          remainingChangedFields: [],
          appliedChangedFields: [],
          improvementId: null,
        },
      },
    });

    await api.cv.acceptImprovement('ptr-99', 'prof-1', {
      acceptedFields: ['', '  ', '\t', ' experience[0].bullets[1] '],
      draftHash: 'hash',
    });

    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.acceptedFields).toEqual(['experience[0].bullets[1]']);
    expect(body.draftHash).toBe('hash');
  });

  it('omits acceptedFields when every entry is blank', async () => {
    const post = vi.spyOn(axiosClient, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          partial: false,
          draftHash: null,
          remainingChangedFields: [],
          appliedChangedFields: [],
          improvementId: null,
        },
      },
    });

    await api.cv.acceptImprovement('ptr-99', 'prof-1', {
      acceptedFields: ['', '  ', '\t'],
    });

    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.acceptedFields).toBeUndefined();
  });
});

describe('api.cv.rejectImprovement', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('omits rejectedFields when only blank strings', async () => {
    const post = vi.spyOn(axiosClient, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          partial: false,
          draftHash: null,
          remainingChangedFields: [],
          improvementId: null,
        },
      },
    });

    await api.cv.rejectImprovement('imp_x', 'prof-1', {
      rejectedFields: ['', ' '],
    });

    const body = post.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(body.rejectedFields).toBeUndefined();
  });
});
