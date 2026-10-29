import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, type CVSectionRecord } from '@/lib/api';
import { saveCVBuilderData, type CVBuilderData } from '@/lib/cvBuilder';
import {
  isCvContentConflictError,
  type CvContentVersionRef,
} from '@/lib/cvContentConflict';

const data = (): CVBuilderData => ({
  personal: {
    name: 'Ada',
    email: 'ada@example.com',
    phone: '',
    location: '',
    headline: 'Dev',
    extras: [],
  },
  summary: { text: 'Builds things.' },
  experience: { items: [] },
  education: { items: [] },
  skills: { categories: [] },
  projects: [],
  certifications: [],
  languages: [],
  achievements: [],
  references: [],
  customSections: [],
  parsedCustomSections: [],
});

const sections = (): CVSectionRecord[] => [
  { id: 's1', type: 'summary', order: 0, hidden: false },
  { id: 'e1', type: 'experience', order: 1, hidden: false },
  { id: 'ed1', type: 'education', order: 2, hidden: false },
  { id: 'p1s', type: 'projects', order: 3, hidden: false },
  { id: 'sk1', type: 'skills', order: 4, hidden: false },
];

function conflictError(): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError(
    'Request failed with status code 409',
    'ERR_BAD_REQUEST',
    config,
    undefined,
    {
      status: 409,
      statusText: 'Conflict',
      headers: {},
      config,
      data: {
        success: false,
        error: { code: 'CV_CONTENT_CONFLICT', message: 'changed elsewhere' },
      },
    },
  );
}

afterEach(() => vi.restoreAllMocks());

describe('saveCVBuilderData content version', () => {
  it('sends the base version and advances it with each write', async () => {
    const patch = vi
      .spyOn(api.cv, 'patchProfilesEntry')
      .mockResolvedValue({ id: 'p1', contentVersion: 8 });
    const batch = vi
      .spyOn(api.cv, 'batchUpsertProfileSections')
      .mockResolvedValue({
        success: true,
        updated: 1,
        unchanged: 0,
        sections: [],
        contentVersion: 9,
      });
    const ref: CvContentVersionRef = { current: 7 };

    await saveCVBuilderData(data(), sections(), {
      cvProfileId: 'p1',
      contentVersionRef: ref,
    });

    expect(patch.mock.calls[0][2]).toEqual({ baseContentVersion: 7 });
    expect(batch.mock.calls[0][2]).toEqual({ baseContentVersion: 8 });
    expect(ref.current).toBe(9);
  });

  it('sends no base when the version is unknown', async () => {
    vi.spyOn(api.cv, 'patchProfilesEntry').mockResolvedValue({
      id: 'p1',
      contentVersion: 3,
    });
    const batch = vi
      .spyOn(api.cv, 'batchUpsertProfileSections')
      .mockResolvedValue({
        success: true,
        updated: 0,
        unchanged: 1,
        sections: [],
      });
    const ref: CvContentVersionRef = { current: null };

    await saveCVBuilderData(data(), sections(), {
      cvProfileId: 'p1',
      contentVersionRef: ref,
    });

    expect(batch.mock.calls[0][2]).toEqual({ baseContentVersion: 3 });
    expect(ref.current).toBe(3);
  });

  it('surfaces a conflict without retrying or falling back', async () => {
    vi.spyOn(api.cv, 'patchProfilesEntry').mockResolvedValue({
      id: 'p1',
      contentVersion: 8,
    });
    const batch = vi
      .spyOn(api.cv, 'batchUpsertProfileSections')
      .mockRejectedValue(conflictError());
    const getSections = vi.spyOn(api.cv, 'getSections');
    const updateSection = vi.spyOn(api.cv, 'updateSection');
    const ref: CvContentVersionRef = { current: 7 };

    const err = await saveCVBuilderData(data(), sections(), {
      cvProfileId: 'p1',
      contentVersionRef: ref,
    }).catch((e: unknown) => e);

    expect(isCvContentConflictError(err)).toBe(true);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(getSections).not.toHaveBeenCalled();
    expect(updateSection).not.toHaveBeenCalled();
  });

  it('stops at a conflicting profile patch instead of retrying a smaller patch', async () => {
    const patch = vi
      .spyOn(api.cv, 'patchProfilesEntry')
      .mockRejectedValue(conflictError());
    const batch = vi.spyOn(api.cv, 'batchUpsertProfileSections');

    const err = await saveCVBuilderData(data(), sections(), {
      cvProfileId: 'p1',
      contentVersionRef: { current: 2 },
    }).catch((e: unknown) => e);

    expect(isCvContentConflictError(err)).toBe(true);
    expect(patch).toHaveBeenCalledTimes(1);
    expect(batch).not.toHaveBeenCalled();
  });
});
