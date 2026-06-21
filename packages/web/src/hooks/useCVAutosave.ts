'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { useToast } from '@/components/ui/Toast';
import type { CVSectionRecord } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import {
  computeCvBuilderSaveFingerprint,
  logCvBuilderSavePerfDev,
  saveCVBuilderData,
  type CVBuilderData,
  type CvBuilderSaveStatus,
  type CvTemplateId,
  type SaveCVBuilderDataResult,
} from '@/lib/cvBuilder';

export type CvBuilderMode = 'onboarding' | 'dashboard';

export type UseCVAutosaveParams = {
  mode: CvBuilderMode;
  profileId?: string | null;
  data: CVBuilderData;
  selectedTemplate: CvTemplateId;
  dirty: boolean;
  /** When true, defer autosave until the improvement diff overlay closes. */
  isDiffOverlayOpen?: boolean;
  setDirty: Dispatch<SetStateAction<boolean>>;
  setSaveStatus: Dispatch<SetStateAction<CvBuilderSaveStatus>>;
  sectionsRef: MutableRefObject<CVSectionRecord[]>;
  dataRef: MutableRefObject<CVBuilderData>;
  templateRef: MutableRefObject<CvTemplateId>;
  lastPersistedFingerprintRef: MutableRefObject<string | null>;
  cvSectionRowsSig: string;
  onDashboardSaved?: (res: SaveCVBuilderDataResult) => void | Promise<void>;
  toast: ReturnType<typeof useToast>;
};

export type UseCVAutosaveResult = {
  flushDashboardAutosave: () => Promise<void>;
};

/**
 * Dashboard autosave: 800ms debounce, fingerprint no-op skip, queued flush while in-flight.
 * Parent owns `dataRef` / `templateRef` / `lastPersistedFingerprintRef` (server hydrate resets fp).
 */
export function useCVAutosave(props: UseCVAutosaveParams): UseCVAutosaveResult {
  const {
    mode,
    profileId,
    data,
    selectedTemplate,
    dirty,
    isDiffOverlayOpen = false,
    setDirty,
    setSaveStatus,
    sectionsRef,
    dataRef,
    templateRef,
    lastPersistedFingerprintRef,
    cvSectionRowsSig,
    onDashboardSaved,
    toast,
  } = props;

  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const saveInFlightRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const onDashboardSavedRef = useRef(onDashboardSaved);
  onDashboardSavedRef.current = onDashboardSaved;
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const flushDashboardAutosave = useCallback(async () => {
    if (mode !== 'dashboard' || !profileId?.trim()) return;
    const fp = computeCvBuilderSaveFingerprint(dataRef.current, templateRef.current, sectionsRef.current);
    if (fp === lastPersistedFingerprintRef.current) {
      setDirty(false);
      setSaveStatus('idle');
      return;
    }
    if (saveInFlightRef.current) {
      saveQueuedRef.current = true;
      return;
    }
    saveInFlightRef.current = true;
    setSaveStatus('saving');
    const t0 = performance.now();
    try {
      const res = await saveCVBuilderData(dataRef.current, sectionsRef.current, {
        template: templateRef.current,
        cvProfileId: profileId ?? undefined,
      });
      logCvBuilderSavePerfDev('autosave.flush', t0, {
        usedBatch: res.usedBatch,
        updated: res.batch?.updated,
        unchanged: res.batch?.unchanged,
      });
      const sectionRowsForFp = res.sections && res.sections.length > 0 ? res.sections : sectionsRef.current;
      lastPersistedFingerprintRef.current = computeCvBuilderSaveFingerprint(
        dataRef.current,
        templateRef.current,
        sectionRowsForFp,
      );
      const stillDirty =
        computeCvBuilderSaveFingerprint(dataRef.current, templateRef.current, sectionsRef.current) !==
        lastPersistedFingerprintRef.current;
      setDirty(stillDirty);
      setSaveStatus(stillDirty ? 'dirty' : 'saved');
      await Promise.resolve(onDashboardSavedRef.current?.(res));
      if (!stillDirty) {
        window.setTimeout(() => {
          setSaveStatus((s) => (s === 'saved' ? 'idle' : s));
        }, 2000);
      }
    } catch (e) {
      setSaveStatus('error');
      toastRef.current.error(getApiErrorMessage(e));
    } finally {
      saveInFlightRef.current = false;
      if (saveQueuedRef.current && dirtyRef.current) {
        saveQueuedRef.current = false;
        queueMicrotask(() => void flushDashboardAutosave());
      } else {
        saveQueuedRef.current = false;
      }
    }
  }, [mode, profileId, setDirty, setSaveStatus]);

  useEffect(() => {
    if (mode !== 'dashboard' || !profileId?.trim()) return;
    if (dirty) return;
    lastPersistedFingerprintRef.current = computeCvBuilderSaveFingerprint(data, selectedTemplate, sectionsRef.current);
  }, [mode, profileId, dirty, data, selectedTemplate, cvSectionRowsSig, lastPersistedFingerprintRef, sectionsRef]);

  useEffect(() => {
    if (mode !== 'dashboard' || !dirty) return;
    if (isDiffOverlayOpen) return;
    setSaveStatus((s) => (s === 'saving' ? s : 'dirty'));
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      autosaveTimerRef.current = null;
      void flushDashboardAutosave();
    }, 800);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [data, mode, dirty, isDiffOverlayOpen, selectedTemplate, profileId, flushDashboardAutosave, setSaveStatus]);

  return { flushDashboardAutosave };
}
