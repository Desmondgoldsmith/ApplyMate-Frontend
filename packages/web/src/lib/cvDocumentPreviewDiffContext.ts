/** Module context for CV document preview diff UI (set once per preview render). */

export let gCvDocPreviewStructuralBefore: unknown;
export let gCvDocPreviewStructuralAfter: unknown;
export let gCvDocPreviewDiffMultiSection = false;

export function setCvDocumentPreviewDiffContext(ctx: {
  structuralBefore?: unknown;
  structuralAfter?: unknown;
  multiSection?: boolean;
}): void {
  gCvDocPreviewStructuralBefore = ctx.structuralBefore;
  gCvDocPreviewStructuralAfter = ctx.structuralAfter;
  gCvDocPreviewDiffMultiSection = Boolean(ctx.multiSection);
}

export type CvPreviewChangedField = {
  field?: string;
  fieldPath?: string;
  fieldLabel?: string;
  before: string;
  after: string;
  type: 'added' | 'removed' | 'changed';
  /** Index into global assistant `sectionDiffs` for per-section accept/reject. */
  sectionDiffIndex?: number;
};

function sectionKey(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveCvPreviewSectionDiff(
  sectionId: string,
  diffSection: string | null | undefined,
  changedFields: CvPreviewChangedField[] | null | undefined,
): {
  isDiff: boolean;
  fields: CvPreviewChangedField[] | null;
  sectionDiffIndex: number | undefined;
} {
  const id = sectionKey(sectionId);
  if (gCvDocPreviewDiffMultiSection) {
    const fields = (changedFields ?? []).filter(
      (cf) => sectionKey(cf.fieldPath ?? cf.field ?? '') === id,
    );
    return {
      isDiff: fields.length > 0,
      fields: fields.length > 0 ? fields : null,
      sectionDiffIndex: fields[0]?.sectionDiffIndex,
    };
  }
  const isDiff = sectionKey(diffSection ?? '') === id;
  return {
    isDiff,
    fields: isDiff ? changedFields ?? null : null,
    sectionDiffIndex: isDiff ? changedFields?.[0]?.sectionDiffIndex : undefined,
  };
}
