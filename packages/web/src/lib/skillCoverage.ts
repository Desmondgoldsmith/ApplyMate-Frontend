import type { JobAnalysis } from '@/lib/api';

export type SkillRequirementTier = 'required' | 'preferred' | 'mentioned';

export type RequirementKind = 'tool' | 'phrase';

export type SkillCoverageItem = {
  skill: string;
  status: 'found' | 'missing' | string;
  importance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  tier?: SkillRequirementTier;
  foundLiterally?: boolean;
  /** ATS keyword chip only — legacy flag on coverage rows. */
  keywordOnly?: boolean;
  requirementKind?: RequirementKind;
  /** OR-group id — when any member is found, siblings are not primary gaps. */
  orGroupId?: string;
};

export type TailorChecklistSkill = NonNullable<JobAnalysis['missingSkills']>[number];

export type GapAdviceType = 'add_skill' | 'use_in_bullets' | 'soft_context';

const ADD_SKILL_ADVICE = new Set<GapAdviceType>(['add_skill']);

const IMPORTANCE_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const TIER_RANK: Record<SkillRequirementTier, number> = {
  required: 0,
  preferred: 1,
  mentioned: 2,
};

export function parseSkillRequirementTier(raw: unknown): SkillRequirementTier | undefined {
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim().toLowerCase();
  if (t === 'required' || t === 'preferred' || t === 'mentioned') return t;
  return undefined;
}

export function skillTierLabel(tier: SkillRequirementTier | undefined): string | null {
  if (!tier) return null;
  if (tier === 'required') return 'Required';
  if (tier === 'preferred') return 'Preferred';
  return 'Mentioned';
}

export function parseRequirementKind(raw: unknown): RequirementKind | undefined {
  if (typeof raw !== 'string') return undefined;
  const k = raw.trim().toLowerCase();
  if (k === 'tool' || k === 'phrase') return k;
  return undefined;
}

export function requirementKindLabel(kind: RequirementKind | undefined): string | null {
  if (kind === 'tool') return 'Tool';
  if (kind === 'phrase') return 'Phrase';
  return null;
}

export function sortMissingSkills(skills: TailorChecklistSkill[]): TailorChecklistSkill[] {
  return [...skills].sort((a, b) => {
    const byImportance =
      (IMPORTANCE_RANK[a.importance] ?? 3) - (IMPORTANCE_RANK[b.importance] ?? 3);
    if (byImportance !== 0) return byImportance;
    const tierA = a.tier ? (TIER_RANK[a.tier] ?? 2) : 0;
    const tierB = b.tier ? (TIER_RANK[b.tier] ?? 2) : 0;
    return tierA - tierB;
  });
}

export function sortSkillCoverage(items: SkillCoverageItem[]): SkillCoverageItem[] {
  return [...items].sort((a, b) => {
    const statusRank = (status: string) => (status === 'missing' ? 0 : 1);
    const byStatus = statusRank(a.status) - statusRank(b.status);
    if (byStatus !== 0) return byStatus;
    return (
      (IMPORTANCE_RANK[a.importance] ?? 3) - (IMPORTANCE_RANK[b.importance] ?? 3)
    );
  });
}

export function parseSkillCoverageFromUnknown(raw: unknown): SkillCoverageItem[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const items: SkillCoverageItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const skill =
      (typeof o.skill === 'string' && o.skill.trim()) ||
      (typeof o.name === 'string' && o.name.trim()) ||
      '';
    if (!skill) continue;
    const statusRaw =
      typeof o.status === 'string' ? o.status.trim().toLowerCase() : 'missing';
    const status = statusRaw === 'found' ? 'found' : 'missing';
    const importanceRaw = String(o.importance ?? 'LOW').toUpperCase();
    const importance =
      importanceRaw === 'CRITICAL' ||
      importanceRaw === 'HIGH' ||
      importanceRaw === 'MEDIUM'
        ? importanceRaw
        : 'LOW';
    const tier = parseSkillRequirementTier(o.tier);
    const foundLiterallyRaw = o.foundLiterally ?? o.found_literally;
    const foundLiterally =
      typeof foundLiterallyRaw === 'boolean' ? foundLiterallyRaw : undefined;
    const keywordOnlyRaw = o.keywordOnly ?? o.keyword_only;
    const keywordOnly = keywordOnlyRaw === true ? true : undefined;
    const requirementKind = parseRequirementKind(o.requirementKind ?? o.requirement_kind ?? o.kind);
    const orGroupIdRaw = o.orGroupId ?? o.or_group_id;
    const orGroupId =
      typeof orGroupIdRaw === 'string' && orGroupIdRaw.trim()
        ? orGroupIdRaw.trim()
        : undefined;
    items.push({
      skill,
      status,
      importance: importance as SkillCoverageItem['importance'],
      ...(tier ? { tier } : {}),
      ...(foundLiterally !== undefined ? { foundLiterally } : {}),
      ...(keywordOnly ? { keywordOnly: true } : {}),
      ...(requirementKind ? { requirementKind } : {}),
      ...(orGroupId ? { orGroupId } : {}),
    });
  }
  return items.length > 0 ? items : undefined;
}

/** Dedupe API missingSkills by normalized name (server dedupes too; guards older rows). */
export function dedupeMissingSkills(
  skills: TailorChecklistSkill[] | undefined,
): TailorChecklistSkill[] {
  const seen = new Set<string>();
  return (skills ?? []).filter((skill) => {
    const key = skill.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** OR groups where at least one alternative is demonstrated on the CV. */
export function satisfiedOrGroupIds(
  items: SkillCoverageItem[] | JobAnalysis['skillCoverage'] | undefined,
): Set<string> {
  const groups = new Map<string, SkillCoverageItem[]>();
  for (const item of items ?? []) {
    const gid = item?.orGroupId?.trim();
    if (!gid) continue;
    const list = groups.get(gid) ?? [];
    list.push(item);
    groups.set(gid, list);
  }
  const satisfied = new Set<string>();
  for (const [gid, members] of groups) {
    if (members.some((member) => member.status === 'found')) {
      satisfied.add(gid);
    }
  }
  return satisfied;
}

/** Actionable gap rows for chips / tailor — excludes keyword-only, mentioned/low, satisfied OR siblings. */
export function isPrimaryGapCoverageItem(
  item: SkillCoverageItem,
  satisfiedOrGroups: Set<string>,
): boolean {
  if (item.status !== 'missing' || item.keywordOnly) return false;
  if (item.tier === 'mentioned' || item.importance === 'LOW') return false;
  const gid = item.orGroupId?.trim();
  if (gid && satisfiedOrGroups.has(gid)) return false;
  return true;
}

/** Actionable add-to-CV gaps from API `missingSkills` (add_skill only when typed). */
export function getActionableMissingSkills(
  analysis: JobAnalysis,
): TailorChecklistSkill[] {
  const fromApi = dedupeMissingSkills(analysis.missingSkills);
  const filtered = fromApi.filter((skill) => {
    const adviceType = (skill as TailorChecklistSkill & { gapAdviceType?: GapAdviceType })
      .gapAdviceType;
    if (adviceType) return ADD_SKILL_ADVICE.has(adviceType);
    return true;
  });
  if (filtered.length > 0) {
    const keywordOnly = keywordOnlySkillSet(analysis.skillCoverage);
    return sortMissingSkills(
      filtered.filter((skill) => !keywordOnly.has(skill.name.trim().toLowerCase())),
    );
  }
  return [];
}

/** Tailor checklist — full server `missingSkills` (tools + phrases, up to 40). */
export function getTailorChecklistSkills(analysis: JobAnalysis): TailorChecklistSkill[] {
  const fromApi = dedupeMissingSkills(analysis.missingSkills);
  if (fromApi.length > 0) {
    return sortMissingSkills(fromApi.slice(0, 40));
  }

  return [];
}

/** Gap chips for analysis UI — `missingSkills` is the single source of truth. */
export function getGapDisplaySkills(analysis: JobAnalysis): TailorChecklistSkill[] {
  return getTailorChecklistSkills(analysis);
}

export function keywordOnlySkillSet(
  items: SkillCoverageItem[] | JobAnalysis['skillCoverage'] | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const item of items ?? []) {
    if (!item?.keywordOnly) continue;
    const key = item.skill.trim().toLowerCase();
    if (key) set.add(key);
  }
  return set;
}

/** Legacy helper — backend now keeps tool vs phrase pools separate on each factor row. */
export function applyKeywordOnlyToFactorsBreakdown<
  T extends { factors: Array<{ key: string; found?: string[]; missing?: string[] }> },
>(breakdown: T | null | undefined, _skillCoverage: JobAnalysis['skillCoverage']): T | null {
  return breakdown ?? null;
}

export function resolveSourceCvProfileId(
  analysis: JobAnalysis | null | undefined,
  fallbackProfileId?: string | null,
): string {
  if (!analysis) return (fallbackProfileId ?? '').trim();
  const meta = analysis as JobAnalysis & {
    sourceCvProfileId?: string | null;
    cvProfileId?: string | null;
  };
  return (
    meta.sourceCvProfileId?.trim() ||
    meta.cvProfileId?.trim() ||
    (fallbackProfileId ?? '').trim()
  );
}
