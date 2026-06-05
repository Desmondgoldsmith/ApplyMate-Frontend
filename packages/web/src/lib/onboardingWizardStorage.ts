import type { CvTemplateId } from '@/lib/cvBuilder';
import { isCvTemplateId } from '@/lib/cvBuilder';
import type { JobSearchUrgency } from '@/lib/api';

export type { JobSearchUrgency };

const KEY = 'applymate_onboarding_wizard_v1';

export type CvPath = 'upload' | 'build' | 'chat' | 'paste' | 'manual' | null;
export type BuildPhase = 'pick' | 'builder';
export type UploadPhase = 'zone' | 'summary' | 'score';

export type CvEntryPhase = 'template' | 'paths';

export type StoredWizardState = {
  step: 1 | 2 | 3;
  cvPath: CvPath;
  /** Step 2: template previews first, then chat/paste/upload options. */
  cvEntryPhase: CvEntryPhase;
  buildPhase: BuildPhase;
  uploadPhase: UploadPhase;
  selectedTemplate: CvTemplateId;
  selectedFeatures: string[];
  /** 0 welcome … 4 referral — only used while API step is 1. */
  discoveryStep?: number;
  focusHired?: boolean;
  focusStudent?: boolean;
  jobSearchUrgency?: JobSearchUrgency | null;
  /** Comma- or newline-separated titles for storage; server sync later. */
  targetRolesText?: string;
  referralSource?: string;
  referralOther?: string;
};

export function readStoredWizard(): Partial<StoredWizardState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY) ?? window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<StoredWizardState> = {};
    if (o.step === 1 || o.step === 2 || o.step === 3) out.step = o.step;
    if (
      o.cvPath === 'upload' ||
      o.cvPath === 'build' ||
      o.cvPath === 'chat' ||
      o.cvPath === 'paste' ||
      o.cvPath === 'manual' ||
      o.cvPath === null
    )
      out.cvPath = o.cvPath;
    if (o.buildPhase === 'pick' || o.buildPhase === 'builder') out.buildPhase = o.buildPhase;
    if (o.uploadPhase === 'zone' || o.uploadPhase === 'summary' || o.uploadPhase === 'score')
      out.uploadPhase = o.uploadPhase;
    if (o.cvEntryPhase === 'template' || o.cvEntryPhase === 'paths') out.cvEntryPhase = o.cvEntryPhase;
    if (typeof o.selectedTemplate === 'string' && isCvTemplateId(o.selectedTemplate)) {
      out.selectedTemplate = o.selectedTemplate;
    }
    if (Array.isArray(o.selectedFeatures)) {
      out.selectedFeatures = o.selectedFeatures.filter((x): x is string => typeof x === 'string');
    }
    if (typeof o.discoveryStep === 'number' && o.discoveryStep >= 0 && o.discoveryStep <= 4) {
      out.discoveryStep = Math.floor(o.discoveryStep);
    }
    if (typeof o.focusHired === 'boolean') out.focusHired = o.focusHired;
    if (typeof o.focusStudent === 'boolean') out.focusStudent = o.focusStudent;
    if (o.jobSearchUrgency === 'asap' || o.jobSearchUrgency === 'few_months' || o.jobSearchUrgency === 'exploring') {
      out.jobSearchUrgency = o.jobSearchUrgency;
    }
    if (typeof o.targetRolesText === 'string') out.targetRolesText = o.targetRolesText;
    if (typeof o.referralSource === 'string') out.referralSource = o.referralSource;
    if (typeof o.referralOther === 'string') out.referralOther = o.referralOther;
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export function writeStoredWizard(state: StoredWizardState): void {
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify(state);
    window.localStorage.setItem(KEY, payload);
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  } catch {
    /* quota / private mode */
  }
}

export function clearStoredWizard(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
