import type { AnalysisAxisKey, JobAnalysisV2, RecruiterVerdict, ApplyStrategy } from '@/lib/api';

function clampAxis(n: unknown): number {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseFloat(n) : NaN;
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function parseStringArray(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim())
    .slice(0, max);
}

function parseVerdict(raw: unknown): RecruiterVerdict | null {
  const s = String(raw ?? '').toUpperCase();
  if (s === 'STRONG' || s === 'COMPETITIVE' || s === 'WEAK') return s;
  return null;
}

function parseApplyStrategy(raw: unknown): ApplyStrategy | null {
  const s = String(raw ?? '').toUpperCase();
  if (s === 'APPLY_NOW' || s === 'TAILOR_FIRST' || s === 'SKIP') return s;
  return null;
}

const AXIS_KEY_ALIASES: Record<string, AnalysisAxisKey> = {
  skillmatch: 'skillMatch',
  skill_match: 'skillMatch',
  experiencefit: 'experienceFit',
  experience_fit: 'experienceFit',
  industryfit: 'industryFit',
  industry_fit: 'industryFit',
  evidencestrength: 'evidenceStrength',
  evidence_strength: 'evidenceStrength',
};

function parseAxisKey(raw: unknown): AnalysisAxisKey | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (s === 'skillMatch' || s === 'experienceFit' || s === 'industryFit' || s === 'evidenceStrength') {
    return s;
  }
  return AXIS_KEY_ALIASES[s.toLowerCase().replace(/-/g, '_')] ?? null;
}

function parsePairedFactorKey(raw: unknown): string | undefined {
  const s =
    (typeof raw === 'string' && raw.trim()) ||
    '';
  return s || undefined;
}

function parseAxisMeta(raw: unknown): JobAnalysisV2['axisMeta'] {
  if (!Array.isArray(raw)) return undefined;
  const items: NonNullable<JobAnalysisV2['axisMeta']> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const key = parseAxisKey(o.key ?? o.axis ?? o.id);
    const description =
      (typeof o.description === 'string' && o.description.trim()) ||
      (typeof o.tooltip === 'string' && o.tooltip.trim()) ||
      '';
    if (!key || !description) continue;
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : undefined;
    const pairedFactorKey = parsePairedFactorKey(
      o.pairedFactorKey ?? o.paired_factor_key,
    );
    items.push({
      key,
      label,
      description,
      ...(pairedFactorKey ? { pairedFactorKey } : {}),
    });
  }
  return items.length > 0 ? items : undefined;
}

export function parseJobAnalysisV2(raw: unknown): JobAnalysisV2 | undefined {
  if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const body = raw as Record<string, unknown>;
  const verdict = parseVerdict(body.recruiterVerdict ?? body.recruiter_verdict);
  const axesRaw = body.axes;
  const attackRaw = body.attackPlan ?? body.attack_plan;
  const strategy = parseApplyStrategy(body.applyStrategy ?? body.apply_strategy);
  if (!verdict || !strategy || axesRaw === null || typeof axesRaw !== 'object' || Array.isArray(axesRaw)) {
    return undefined;
  }
  const axesObj = axesRaw as Record<string, unknown>;
  const attack =
    attackRaw !== null && typeof attackRaw === 'object' && !Array.isArray(attackRaw)
      ? (attackRaw as Record<string, unknown>)
      : {};

  return {
    recruiterVerdict: verdict,
    axes: {
      skillMatch: clampAxis(axesObj.skillMatch ?? axesObj.skill_match),
      experienceFit: clampAxis(axesObj.experienceFit ?? axesObj.experience_fit),
      industryFit: clampAxis(axesObj.industryFit ?? axesObj.industry_fit),
      evidenceStrength: clampAxis(axesObj.evidenceStrength ?? axesObj.evidence_strength),
    },
    attackPlan: {
      topCVFixes: parseStringArray(attack.topCVFixes ?? attack.top_cv_fixes, 6),
      interviewRisks: parseStringArray(attack.interviewRisks ?? attack.interview_risks, 6),
      missingEvidence: parseStringArray(attack.missingEvidence ?? attack.missing_evidence, 6),
      salaryRange:
        typeof attack.salaryRange === 'string'
          ? attack.salaryRange.trim()
          : typeof attack.salary_range === 'string'
            ? attack.salary_range.trim()
            : undefined,
    },
    applyStrategy: strategy,
    axisMeta: parseAxisMeta(body.axisMeta ?? body.axis_meta),
  };
}

export function resolveAxisTooltips(
  v2: JobAnalysisV2 | undefined,
  factorsBreakdown?: { factors: Array<{ key: string; hint?: string }> } | null,
): Record<AnalysisAxisKey, string> {
  const defaults = Object.fromEntries(
    ANALYSIS_AXIS_META.map((axis) => [axis.key, axis.tooltip]),
  ) as Record<AnalysisAxisKey, string>;
  if (!v2?.axisMeta?.length) return defaults;
  const out = { ...defaults };
  const factorByKey = new Map(
    (factorsBreakdown?.factors ?? []).map((factor) => [factor.key, factor]),
  );
  for (const item of v2.axisMeta) {
    const pairedKey = item.pairedFactorKey?.trim();
    const pairedHint = pairedKey ? factorByKey.get(pairedKey)?.hint?.trim() : '';
    if (pairedHint) {
      out[item.key] = pairedHint;
      continue;
    }
    if (item.description.trim()) {
      out[item.key] = item.description.trim();
    }
  }
  return out;
}

/** Keep v2 evidence axis aligned with the 6th factor row when both are present. */
export function resolveAnalysisV2Axes(
  v2: JobAnalysisV2,
  factorsBreakdown?: { factors: Array<{ key: string; score: number }> } | null,
): JobAnalysisV2['axes'] {
  const axes = { ...v2.axes };
  const evidenceFactor = factorsBreakdown?.factors.find(
    (factor) => factor.key === 'evidenceStrength',
  );
  if (evidenceFactor && Number.isFinite(evidenceFactor.score)) {
    axes.evidenceStrength = evidenceFactor.score;
  }
  return axes;
}

export const ANALYSIS_AXIS_META = [
  {
    key: 'skillMatch' as const,
    label: 'Skill match',
    tooltip: 'Overlap between required job skills and what your CV demonstrates.',
  },
  {
    key: 'experienceFit' as const,
    label: 'Experience fit',
    tooltip: 'How well your years and scope of experience align with this role level.',
  },
  {
    key: 'industryFit' as const,
    label: 'Industry fit',
    tooltip: 'Domain familiarity — sector, tools, and context the employer expects.',
  },
  {
    key: 'evidenceStrength' as const,
    label: 'Evidence strength',
    tooltip: 'How well your CV proves fit for this specific role — not generic CV length.',
  },
];
