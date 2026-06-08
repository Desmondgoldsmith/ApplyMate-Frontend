import type { JobAnalysis } from '@/lib/api';

export type SkillCoverageItem = {
  skill: string;
  status: 'found' | 'missing' | string;
  importance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
};

export type TailorChecklistSkill = NonNullable<JobAnalysis['missingSkills']>[number];

const IMPORTANCE_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

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
        : importanceRaw === 'LOW'
          ? 'LOW'
          : 'LOW';
    items.push({
      skill,
      status,
      importance: importance as SkillCoverageItem['importance'],
    });
  }
  return items.length > 0 ? items : undefined;
}

/** Tailor checklist: prefer AI inventory gaps, else API missingSkills. */
export function getTailorChecklistSkills(analysis: JobAnalysis): TailorChecklistSkill[] {
  if (analysis.skillCoverage?.length) {
    return sortSkillCoverage(analysis.skillCoverage)
      .filter((item) => item.status === 'missing')
      .map((item) => ({ name: item.skill, importance: item.importance }));
  }
  return analysis.missingSkills ?? [];
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
