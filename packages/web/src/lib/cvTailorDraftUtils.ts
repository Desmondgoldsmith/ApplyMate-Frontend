import type { CvTailorDraft, CvTailorDraftEntry, CvTailorDraftSectionStatus } from '@/lib/api';

export function patchTailorDraftEntry(
  draft: CvTailorDraft,
  sectionId: string,
  patch: Partial<Pick<CvTailorDraftEntry, 'status' | 'patchId'>>,
): CvTailorDraft {
  return {
    ...draft,
    drafts: draft.drafts.map((d) => (d.sectionId === sectionId ? { ...d, ...patch } : d)),
  };
}
