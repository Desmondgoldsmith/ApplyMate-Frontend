import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/lib/api';
import { axiosClient } from '@/lib/axios';

const row = (id: string) => ({
  id,
  title: `Job ${id}`,
  company: 'Acme',
  bookmarkedAt: '2026-10-29T00:00:00.000Z',
  hubPipelineStage: 'saved',
});

const ok = (data: unknown) => ({
  data: { success: true, data },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as never,
});

afterEach(() => vi.restoreAllMocks());

describe('api.jobDiscovery.listBookmarks', () => {
  it('follows nextCursor until the last page', async () => {
    const get = vi
      .spyOn(axiosClient, 'get')
      .mockResolvedValueOnce(
        ok({ items: [row('a'), row('b')], nextCursor: 'c1' }),
      )
      .mockResolvedValueOnce(ok({ items: [row('c')], nextCursor: null }));

    const items = await api.jobDiscovery.listBookmarks();

    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][1]).toMatchObject({
      params: { paged: true, limit: 100 },
    });
    expect(get.mock.calls[1][1]).toMatchObject({ params: { cursor: 'c1' } });
  });

  it('still works against an API that returns a plain array', async () => {
    const get = vi
      .spyOn(axiosClient, 'get')
      .mockResolvedValueOnce(ok([row('a')]));

    const items = await api.jobDiscovery.listBookmarks();

    expect(items.map((i) => i.id)).toEqual(['a']);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
