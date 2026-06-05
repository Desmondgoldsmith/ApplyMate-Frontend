/**
 * Converts AI patch / diff payloads into human-readable strings for preview UI.
 * Handles `{ action, field, value }`, nested section JSON, and legacy string blobs.
 */

import {
  assistantChangedFieldLabel,
  assistantDiffDisplayStrings,
  assistantSectionBlobToDisplayString,
  readCvDataSummaryText,
} from '@/lib/cvAssistantDiffDisplay';
import type { CvDiffPreviewOpenParams } from '@/lib/api';
import { cvStructuralDiffPayloadPresent } from '@/lib/cvDiffPreviewMap';

const PATCH_ACTIONS = new Set([
  'replace',
  'add',
  'remove',
  'set',
  'update',
  'append',
  'delete',
  'insert',
  'merge',
]);

export type CvDiffChangedFieldDisplay = {
  field?: string;
  fieldPath: string;
  fieldLabel?: string;
  before: string;
  after: string;
  type: 'added' | 'removed' | 'changed';
};

function trimToMax(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function readTextField(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && 'text' in (value as object)) {
    const t = (value as { text?: unknown }).text;
    if (typeof t === 'string') return t.trim();
  }
  return '';
}

function parseMaybeJsonString(raw: string): unknown {
  const t = raw.trim();
  if (!t) return '';
  if (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']'))
  ) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return raw;
    }
  }
  return raw;
}

function patchActionName(o: Record<string, unknown>): string | null {
  const action = o.action ?? o.op ?? o.operation ?? o.type;
  if (typeof action !== 'string') return null;
  const a = action.trim().toLowerCase();
  return PATCH_ACTIONS.has(a) ? a : null;
}

/** True when value looks like a single AI patch operation. */
export function isAiPatchOperation(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as Record<string, unknown>;
  if (patchActionName(o)) return true;
  const hasValue =
    'value' in o ||
    'newValue' in o ||
    'new_value' in o ||
    'content' in o ||
    'text' in o;
  const hasTarget =
    'field' in o ||
    'path' in o ||
    'fieldPath' in o ||
    'field_path' in o ||
    'target' in o;
  return hasValue && hasTarget;
}

function readPatchSide(
  o: Record<string, unknown>,
  side: 'before' | 'after',
): string {
  const afterKeys =
    side === 'after'
      ? ['value', 'newValue', 'new_value', 'to', 'after', 'content', 'text']
      : ['oldValue', 'old_value', 'from', 'before', 'previous', 'prior'];
  for (const key of afterKeys) {
    const v = o[key];
    if (v === undefined || v === null) continue;
    const s = coerceAiPatchToDisplayString(v);
    if (s) return s;
  }
  return '';
}

/** Split a patch operation into before/after display strings when both sides exist. */
export function aiPatchOperationToSides(value: unknown): {
  before: string;
  after: string;
} {
  if (!isAiPatchOperation(value)) {
    const s = coerceAiPatchToDisplayString(value);
    return { before: '', after: s };
  }
  const o = value as Record<string, unknown>;
  const before = readPatchSide(o, 'before');
  const after = readPatchSide(o, 'after');
  return { before, after };
}

/**
 * Coerce any AI patch / section blob into plain text for inputs and diff UI.
 */
export function coerceAiPatchToDisplayString(
  value: unknown,
  sectionHint = '',
  fieldHint = '',
): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    const parsed = parseMaybeJsonString(value);
    if (parsed !== value) {
      const nested = coerceAiPatchToDisplayString(parsed, sectionHint, fieldHint);
      if (nested) return nested;
    }
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => coerceAiPatchToDisplayString(item, sectionHint, fieldHint))
      .filter(Boolean);
    return parts.join('\n\n').trim();
  }
  if (typeof value !== 'object') return String(value);

  const o = value as Record<string, unknown>;

  if (isAiPatchOperation(o)) {
    const { before, after } = aiPatchOperationToSides(o);
    return after || before;
  }

  if ('patch' in o) {
    const nested = coerceAiPatchToDisplayString(o.patch, sectionHint, fieldHint);
    if (nested) return nested;
  }
  if ('patches' in o && Array.isArray(o.patches)) {
    const nested = coerceAiPatchToDisplayString(o.patches, sectionHint, fieldHint);
    if (nested) return nested;
  }
  if ('changes' in o && Array.isArray(o.changes)) {
    const nested = coerceAiPatchToDisplayString(o.changes, sectionHint, fieldHint);
    if (nested) return nested;
  }

  const text = readTextField(o);
  if (text) return text;

  const section = sectionHint.trim().toLowerCase();
  if (section === 'summary' || 'summary' in o) {
    const summaryText = readCvDataSummaryText(
      'summary' in o ? { summary: o.summary ?? o } : value,
    );
    if (summaryText.trim()) return summaryText.trim();
  }

  const fieldKey = fieldHint.trim();
  if (fieldKey) {
    const direct = o[fieldKey];
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    if (direct != null) {
      const nested = coerceAiPatchToDisplayString(direct, sectionHint, '');
      if (nested) return nested;
    }
  }

  if (section) {
    const fromSection = assistantSectionBlobToDisplayString(section, value);
    if (fromSection.trim()) return fromSection.trim();
  }

  const keys = Object.keys(o);
  if (keys.length === 1) {
    const only = o[keys[0]!];
    const nested = coerceAiPatchToDisplayString(only, sectionHint, fieldHint);
    if (nested) return nested;
  }

  return '';
}

export function normalizeCvDiffChangedField(
  field: {
    field?: string;
    fieldPath: string;
    fieldLabel?: string;
    before: unknown;
    after: unknown;
    type: 'added' | 'removed' | 'changed';
  },
  sectionHint: string,
): CvDiffChangedFieldDisplay {
  const fieldPath = (field.fieldPath ?? field.field ?? '').trim();
  const fieldLabel =
    (field.fieldLabel ?? field.field ?? fieldPath).trim() || fieldPath;

  let before = coerceAiPatchToDisplayString(field.before, sectionHint, fieldPath);
  let after = coerceAiPatchToDisplayString(field.after, sectionHint, fieldPath);

  if (!before && !after && isAiPatchOperation(field.after)) {
    const sides = aiPatchOperationToSides(field.after);
    before = sides.before;
    after = sides.after;
  }
  if (!before && !after && isAiPatchOperation(field.before)) {
    const sides = aiPatchOperationToSides(field.before);
    before = sides.before;
    after = sides.after;
  }

  return {
    ...field,
    fieldPath: fieldPath || sectionHint || 'update',
    fieldLabel,
    field: fieldLabel,
    before,
    after,
    type: field.type ?? 'changed',
  };
}

/** Normalize apply/assistant diff preview params for consistent human-readable UI. */
export function normalizeCvDiffPreviewParams(
  params: CvDiffPreviewOpenParams,
): CvDiffPreviewOpenParams {
  const section = (params.section ?? '').trim() || 'summary';
  let changedFields = (params.changedFields ?? []).map((cf) =>
    normalizeCvDiffChangedField(
      {
        field: cf.field,
        fieldPath: cf.fieldPath ?? cf.field ?? section,
        fieldLabel: cf.fieldLabel,
        before: cf.before,
        after: cf.after,
        type: cf.type ?? 'changed',
      },
      section,
    ),
  );

  const hasMeaningfulField = changedFields.some(
    (cf) => cf.before.trim() || cf.after.trim(),
  );

  if (
    !hasMeaningfulField &&
    cvStructuralDiffPayloadPresent(params.before, params.after)
  ) {
    const { before, after } = assistantDiffDisplayStrings(
      section,
      params.before,
      params.after,
    );
    if (before.trim() || after.trim()) {
      changedFields = [
        {
          fieldPath: section,
          field: assistantChangedFieldLabel(section),
          fieldLabel: assistantChangedFieldLabel(section),
          before,
          after,
          type: 'changed',
        },
      ];
    }
  }

  return { ...params, changedFields };
}

/** Tailor / line-diff friendly section strings (never raw patch JSON). */
export function coerceAiPatchSectionBlob(
  value: unknown,
  sectionType: string,
): string {
  const section = sectionType.trim() || 'summary';
  const text = coerceAiPatchToDisplayString(value, section);
  if (text) return text;
  return assistantSectionBlobToDisplayString(section, value).trim();
}

export function trimCvDiffDisplay(text: string, max = 12000): string {
  return trimToMax(text, max);
}
