import { renderHook, act, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCVAutosave } from '@/hooks/useCVAutosave';
import type { CVSectionRecord } from '@/lib/api';
import * as cvBuilder from '@/lib/cvBuilder';
import type { CVBuilderData, CvBuilderSaveStatus, CvTemplateId } from '@/lib/cvBuilder';

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
  return { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } as unknown as ReturnType<
    typeof import('@/components/ui/Toast').useToast
  >;
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
