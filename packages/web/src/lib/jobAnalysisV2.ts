import type { JobAnalysisV2, RecruiterVerdict, ApplyStrategy } from '@/lib/api';

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
      topCVFixes: parseStringArray(attack.topCVFixes ?? attack.top_cv_fixes, 3),
      interviewRisks: parseStringArray(attack.interviewRisks ?? attack.interview_risks, 3),
      missingEvidence: parseStringArray(attack.missingEvidence ?? attack.missing_evidence, 3),
      salaryRange:
        typeof attack.salaryRange === 'string'
          ? attack.salaryRange.trim()
          : typeof attack.salary_range === 'string'
            ? attack.salary_range.trim()
            : undefined,
    },
    applyStrategy: strategy,
  };
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
    tooltip: 'Quality of proof in your CV: metrics, outcomes, and specific examples.',
  },
];
