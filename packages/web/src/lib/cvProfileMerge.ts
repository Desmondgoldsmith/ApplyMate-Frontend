import type { CVProfile } from '@/lib/api';

export type CvMergeMode = 'preview' | 'create';

export type CvMergeSourceProfile = {
  id: string;
  name: string;
};

export type CvMergeSectionRow = {
  type: string;
  label: string;
  itemCount: number;
  order: number;
};

export type CvMergePreviewResult = {
  type: 'preview';
  mergeId: string;
  suggestedName: string;
  sourceProfiles: CvMergeSourceProfile[];
  structured: Record<string, unknown>;
  sections: CvMergeSectionRow[];
  instructions: string;
};

export type CvMergeCreatedResult = {
  type: 'created';
  mergeId: string;
  profileId: string;
  sourceProfileIds: string[];
  /** Full profile envelope when the API returns it (optional). */
  profile?: CVProfile;
};

export type CvMergeProfilesResponse = CvMergePreviewResult | CvMergeCreatedResult;

export const CV_MERGE_MAX_PROFILES = 6;
export const CV_MERGE_MIN_PROFILES = 2;

function pickString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizeSourceProfile(raw: unknown): CvMergeSourceProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = pickString(o.id);
  const name = pickString(o.name);
  if (!id) return null;
  return { id, name: name || 'Untitled CV' };
}

function normalizeMergeSection(raw: unknown): CvMergeSectionRow | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const type = pickString(o.type) || pickString(o.sectionType) || 'section';
  const label =
    pickString(o.label) ||
    pickString(o.title) ||
    pickString(o.name) ||
    type;
  const itemCount =
    typeof o.itemCount === 'number' && Number.isFinite(o.itemCount)
      ? Math.max(0, Math.floor(o.itemCount))
      : typeof o.items === 'number' && Number.isFinite(o.items)
        ? Math.max(0, Math.floor(o.items))
        : Array.isArray(o.items)
          ? o.items.length
          : 0;
  const order =
    typeof o.order === 'number' && Number.isFinite(o.order)
      ? Math.floor(o.order)
      : 0;
  return { type, label, itemCount, order };
}

function normalizeStructured(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}

export function normalizeCvMergePreviewResponse(raw: unknown): CvMergePreviewResult {
  const body =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const mergeId = pickString(body.mergeId ?? body.merge_id);
  const suggestedName =
    pickString(body.suggestedName ?? body.suggested_name) || 'Merged CV';
  const sourceProfiles = (
    Array.isArray(body.sourceProfiles)
      ? body.sourceProfiles
      : Array.isArray(body.source_profiles)
        ? body.source_profiles
        : []
  )
    .map((row) => normalizeSourceProfile(row))
    .filter((row): row is CvMergeSourceProfile => row != null);
  const sections = (
    Array.isArray(body.sections) ? body.sections : []
  )
    .map((row) => normalizeMergeSection(row))
    .filter((row): row is CvMergeSectionRow => row != null)
    .sort((a, b) => a.order - b.order);
  return {
    type: 'preview',
    mergeId,
    suggestedName,
    sourceProfiles,
    structured: normalizeStructured(body.structured),
    sections,
    instructions: pickString(body.instructions),
  };
}

export function normalizeCvMergeCreatedResponse(raw: unknown): CvMergeCreatedResult {
  const body =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const mergeId = pickString(body.mergeId ?? body.merge_id);
  const profileId =
    pickString(body.profileId ?? body.profile_id) ||
    pickString(
      body.profile && typeof body.profile === 'object'
        ? (body.profile as Record<string, unknown>).id
        : '',
    );
  if (!profileId) {
    throw new Error('Merge create response missing profile id');
  }
  const sourceProfileIds = (
    Array.isArray(body.sourceProfileIds)
      ? body.sourceProfileIds
      : Array.isArray(body.source_profile_ids)
        ? body.source_profile_ids
        : []
  )
    .map((id) => pickString(id))
    .filter(Boolean);
  const profileRaw =
    body.profile && typeof body.profile === 'object' && !Array.isArray(body.profile)
      ? (body.profile as Record<string, unknown>)
      : null;
  const profile: CVProfile | undefined = profileRaw
    ? {
        id: profileId,
        rawText:
          typeof profileRaw.rawText === 'string' ? profileRaw.rawText : undefined,
        structured:
          profileRaw.structured !== null && typeof profileRaw.structured === 'object'
            ? (profileRaw.structured as CVProfile['structured'])
            : undefined,
        template:
          typeof profileRaw.template === 'string' ? profileRaw.template : undefined,
        createdAt:
          typeof profileRaw.createdAt === 'string' ? profileRaw.createdAt : undefined,
        updatedAt:
          typeof profileRaw.updatedAt === 'string' ? profileRaw.updatedAt : undefined,
      }
    : undefined;
  return {
    type: 'created',
    mergeId,
    profileId,
    sourceProfileIds,
    ...(profile ? { profile } : {}),
  };
}

export function normalizeCvMergeProfilesResponse(raw: unknown): CvMergeProfilesResponse {
  const body =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const type = pickString(body.type).toLowerCase();
  if (type === 'created') return normalizeCvMergeCreatedResponse(body);
  return normalizeCvMergePreviewResponse(body);
}
