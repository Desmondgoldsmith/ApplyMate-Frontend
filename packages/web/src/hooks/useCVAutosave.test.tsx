import { renderHook, act, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCVAutosave } from '@/hooks/useCVAutosave';
import type { CVSectionRecord } from '@/lib/api';
import * as cvBuilder from '@/lib/cvBuilder';
import type {
  CVBuilderData,
  CvBuilderSaveStatus,
  CvTemplateId,
} from '@/lib/cvBuilder';

const minimalData = (): CVBuilderData => ({
  personal: {
    name: 'A',
    email: 'a@b.co',
    phone: '',
    location: '',
    headline: 'Dev',
    extras: [],
  },
  summary: { text: 'Hi' },
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

const minimalSections = (): CVSectionRecord[] => [
  { id: 's1', type: 'summary', order: 0, hidden: false },
  { id: 'e1', type: 'experience', order: 1, hidden: false },
  { id: 'ed1', type: 'education', order: 2, hidden: false },
  { id: 'sk1', type: 'skills', order: 3, hidden: false },
];

function toastStub() {
  return {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  } as unknown as ReturnType<typeof import('@/components/ui/Toast').useToast>;
}

function useAutosaveHarness() {
  const [data, setData] = useState(minimalData);
  const [dirty, setDirty] = useState(true);
  const [saveStatus, setSaveStatus] = useState<CvBuilderSaveStatus>('idle');
  const sectionsRef = useRef(minimalSections());
  sectionsRef.current = minimalSections();
  const dataRef = useRef(data);
  dataRef.current = data;
  const templateRef = useRef<CvTemplateId>('modern');
  templateRef.current = 'modern';
  const lastPersistedFingerprintRef = useRef<string | null>(null);

  useCVAutosave({
    mode: 'dashboard',
    profileId: 'p1',
    data,
    selectedTemplate: 'modern',
    dirty,
    setDirty,
    setSaveStatus,
    sectionsRef,
    dataRef,
    templateRef,
    lastPersistedFingerprintRef,
    cvSectionRowsSig: 's1|e1|ed1|sk1',
    toast: toastStub(),
  });

  return { setData, setDirty, saveStatus };
}

describe('useCVAutosave', () => {
  let saveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    saveSpy = vi.spyOn(cvBuilder, 'saveCVBuilderData').mockResolvedValue({
      usedBatch: true,
      batch: { updated: 1, unchanged: 0 },
      sections: minimalSections(),
    } as cvBuilder.SaveCVBuilderDataResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('reports a content conflict instead of a generic error and stops autosaving', async () => {
    const toast = toastStub();
    const onContentConflict = vi.fn();
    saveSpy.mockRejectedValue(
      new AxiosError(
        'conflict',
        'ERR_BAD_REQUEST',
        { headers: new AxiosHeaders() } as never,
        undefined,
        {
          status: 409,
          statusText: 'Conflict',
          headers: {},
          config: { headers: new AxiosHeaders() } as never,
          data: {
            success: false,
            error: { code: 'CV_CONTENT_CONFLICT', message: 'x' },
          },
        },
      ),
    );
    const versionRef = { current: 4 };

    function useConflictHarness() {
      const [data, setData] = useState(minimalData);
      const [dirty, setDirty] = useState(true);
      const [, setSaveStatus] = useState<CvBuilderSaveStatus>('idle');
      const [conflict, setConflict] = useState(false);
      const sectionsRef = useRef(minimalSections());
      const dataRef = useRef(data);
      dataRef.current = data;
      const templateRef = useRef<CvTemplateId>('modern');
      const lastPersistedFingerprintRef = useRef<string | null>(null);
      useCVAutosave({
        mode: 'dashboard',
        profileId: 'p1',
        data,
        selectedTemplate: 'modern',
        dirty,
        setDirty,
        setSaveStatus,
        sectionsRef,
        dataRef,
        templateRef,
        lastPersistedFingerprintRef,
        cvSectionRowsSig: 's1|e1|ed1|sk1',
        toast,
        contentVersionRef: versionRef,
        contentConflict: conflict,
        onContentConflict: () => {
          onContentConflict();
          setConflict(true);
        },
      });
      return { setData };
    }

    const { result, unmount } = renderHook(() => useConflictHarness());
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    await waitFor(() => expect(onContentConflict).toHaveBeenCalledTimes(1));
    expect(saveSpy.mock.calls[0][2]).toMatchObject({
      contentVersionRef: versionRef,
    });
    expect(toast.error).not.toHaveBeenCalled();

    await act(async () => {
      result.current.setData({
        ...minimalData(),
        summary: { text: 'More typing' },
      });
    });
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(saveSpy).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('waits 800ms before calling saveCVBuilderData', async () => {
    const { unmount } = renderHook(() => useAutosaveHarness());

    expect(saveSpy).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(799);
    });
    expect(saveSpy).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    unmount();
  });
});
