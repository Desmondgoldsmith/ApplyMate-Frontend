'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { CvSpellIssue } from '@/lib/api';
import type { CVBuilderData } from '@/lib/cvBuilder';
import type { CvRecruiterScanReadingPathEntry } from '@/lib/cvRecruiterScan';

export type HeaderPreviewSettings = {
  /** Role headline line below name */
  showHeadline: boolean;
  showTitle: boolean;
  showPhone: boolean;
  /** LinkedIn URL row */
  showLinkedIn: boolean;
  /** GitHub URL row */
  showGithub: boolean;
  /** Website URL row */
  showWebsiteToggle: boolean;
  /** Portfolio URL row */
  showPortfolioToggle: boolean;
  /** @deprecated migrated to showLinkedIn/showGithub */
  showLink?: boolean;
  /** @deprecated migrated to showPortfolioToggle — sessionStorage only */
  showExtraLink?: boolean;
  showEmail: boolean;
  showLocation: boolean;
  uppercaseName: boolean;
  showPhoto: boolean;
  /** Extra custom rows */
  extraField: boolean;
  dateOfBirth: boolean;
  nationality: boolean;
  photoStyle: 'circle' | 'square' | 'avatar';
};

export const DEFAULT_HEADER_PREVIEW: HeaderPreviewSettings = {
  showHeadline: true,
  showTitle: true,
  showPhone: true,
  showLinkedIn: true,
  showGithub: true,
  showWebsiteToggle: true,
  showPortfolioToggle: true,
  showEmail: true,
  showLocation: true,
  uppercaseName: false,
  showPhoto: true,
  extraField: true,
  dateOfBirth: true,
  nationality: true,
  photoStyle: 'circle',
};

export type CvAssistantRunResult = 'ok' | 'clarify' | 'error' | 'skipped';

export type CVEditContextValue = {
  onUpdate: (patch: Partial<CVBuilderData>) => void;
  isEditing: boolean;
  data: CVBuilderData;
  /** Bumps after undo/redo so inline editors resync from parent `data`. */
  dataRevision?: number;
  activeSection: string | null;
  setActiveSection: (id: string | null) => void;
  focusedSection: string | null;
  setFocusedSection: (id: string | null) => void;
  /**
   * Accordion/preview key of the section currently under AI diff review (single-suggestion
   * apply / section assistant). When set, that section is kept fully visible while the
   * others are dimmed so the user's attention is on the change being reviewed.
   */
  diffSection?: string | null;
  focusedEntryId: string | null;
  setFocusedEntryId: (id: string | null) => void;
  focusedEntrySection: string | null;
  setFocusedEntrySection: (id: string | null) => void;
  headerPreview: HeaderPreviewSettings;
  setHeaderPreview: (patch: Partial<HeaderPreviewSettings>) => void;
  /** Section `type` values present on the CV profile (API). Used for optional blocks. */
  optionalSectionPresence: Set<string>;
  incompleteSectionIds: Set<string>;
  spellIssuesBySection: Record<string, number>;
  spellIssueEntriesBySection: Record<string, CvSpellIssue[]>;
  spellIssuesByField: Record<string, CvSpellIssue[]>;
  onApplySpellIssue?: (issue: CvSpellIssue) => void;
  onDismissSpellIssue?: (issue: CvSpellIssue) => void;
  /** Dashboard: inline section assistant (preview teardrop). Optional `sectionKey` is accordion/preview id (e.g. `experience`, `parsed-{rowId}`). */
  runCvAssistantCommand?: (
    command: string,
    clarifications?: Array<{ question: string; answer: string }>,
    sectionKey?: string,
  ) => Promise<CvAssistantRunResult>;
  cvAssistantBusy?: boolean;
  /** e.g. "Generating changes…" while a section assistant command runs. */
  cvAssistantBusyMessage?: string | null;
  /** Recruiter Scan heatmap overlay keyed by preview section id. */
  recruiterScanHeatmap?: Record<string, CvRecruiterScanReadingPathEntry> | null;
  /** Only the Onyx template supports profile photo upload in the header. */
  photoUploadEnabled?: boolean;
  /** @deprecated Clarification uses {@link CvAssistantClarificationModal} in clinic. */
  cvAssistantClarificationQuestion?: string | null;
};

const CVEditContext = createContext<CVEditContextValue | null>(null);

export function CVEditProvider({ value, children }: { value: CVEditContextValue; children: ReactNode }) {
  return <CVEditContext.Provider value={value}>{children}</CVEditContext.Provider>;
}

export function useCVEdit(): CVEditContextValue | null {
  return useContext(CVEditContext);
}
