'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CvScoreSectionExplainer } from '@/components/cv/CvScoreSectionExplainer';
import { GlowCard } from '@/components/ui/GlowCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { useCvScoreSectionActions } from '@/hooks/useCvScoreSectionActions';
import { cn } from '@/lib/utils';
import type {
  ATSCompatibility,
  AtsStructureIssue,
  CareerStage,
  CVFlag,
  CVImprovement,
  CVImprovementItem,
  CVScoreBreakdown,
  CvDiffPreviewOpenParams,
  JobMatchSectionScore,
  SectionScore,
} from '@/lib/api';
import {
  buildSectionExplainerFallback,
  cvSectionLabel,
  parseBreakdownSectionExplainers,
  parseSectionScoreWithExplainer,
  type CvSectionScoreExplainer,
  type CvSectionScoreKey,
} from '@/lib/cvSectionScoreExplainer';
import { AtsSimulationInsights } from '@/components/cv/AtsSimulationInsights';
import { parseAtsSimulationReport } from '@/lib/atsSimulation';
import { scoreBreakdownFromPayload } from '@/lib/cvBuilder';
import {
  formatAiDimensionLabel,
  hybridBlendCompactLine,
  hybridOverallFormulaExample,
  hybridWeightsSummaryLine,
  hybridWeightsTooltip,
  hybridScoringFromScorePayload,
  parseAnalysisUiHints,
  parseCvHybridScoring,
  type CvHybridScoringMeta,
} from '@/lib/cvHybridScoring';
import type { CVScorePayload } from '@/lib/api';
import { canShowCvImprovementFixWithAI } from '@/lib/cvImprovementFieldPath';

const RING_VIEW = 80;
const RING_CX = RING_VIEW / 2;
const RING_CY = RING_VIEW / 2;
const RING_R = 31;
const RING_STROKE = 6;
const RING_C = 2 * Math.PI * RING_R;

function sectionScoreBarColor(score: number): string {
  if (score >= 80) return 'var(--ck-success-text)';
  if (score >= 60) return 'var(--ck-warning-text)';
  return 'var(--ck-danger-text)';
}

const CAREER_STAGE_LABELS: Record<string, string> = {
  student: 'Student / Entry Level',
  early: 'Early Career (0-3 years)',
  mid: 'Mid Career (3-8 years)',
  senior: 'Senior (8+ years)',
};

const EMPTY_SECTION = (): SectionScore => ({
  score: 0,
  weight: 0,
  feedback: '',
  flags: [],
});

function parseSectionScore(raw: unknown): SectionScore {
  return parseSectionScoreWithExplainer(raw);
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim());
}

function parseAtsStructureIssues(raw: unknown): AtsStructureIssue[] {
  if (!Array.isArray(raw)) return [];
  const out: AtsStructureIssue[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const suggestion =
      (typeof o.suggestion === 'string' && o.suggestion.trim()) ||
      (typeof o.message === 'string' && o.message.trim()) ||
      '';
    if (!suggestion) continue;
    const type =
      (typeof o.type === 'string' && o.type.trim()) ||
      (typeof o.issueType === 'string' && o.issueType.trim()) ||
      'structure';
    const severityRaw =
      typeof o.severity === 'string'
        ? o.severity.trim().toLowerCase()
        : 'medium';
    const affectedSection =
      (typeof o.affectedSection === 'string' && o.affectedSection.trim()) ||
      (typeof o.affected_section === 'string' && o.affected_section.trim()) ||
      undefined;
    out.push({
      type,
      severity: severityRaw,
      suggestion,
      ...(affectedSection ? { affectedSection } : {}),
    });
  }
  return out;
}

function parseAts(raw: unknown): ATSCompatibility {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const scoreN = typeof o.score === 'number' ? o.score : Number(o.score);
    const issues = Array.isArray(o.issues)
      ? o.issues.filter((x): x is string => typeof x === 'string')
      : [];
    const passed = Array.isArray(o.passed)
      ? o.passed.filter((x): x is string => typeof x === 'string')
      : [];
    const methodologyNote =
      typeof o.methodologyNote === 'string'
        ? o.methodologyNote.trim()
        : typeof o.methodology_note === 'string'
          ? o.methodology_note.trim()
          : undefined;
    const structureIssues = parseAtsStructureIssues(
      o.structureIssues ?? o.structure_issues,
    );
    const structureScoreRaw = o.structureScore ?? o.structure_score;
    const structureScore =
      typeof structureScoreRaw === 'number' &&
      Number.isFinite(structureScoreRaw)
        ? Math.round(structureScoreRaw)
        : undefined;
    const structurePassedRaw = o.structurePassed ?? o.structure_passed;
    const structurePassed =
      typeof structurePassedRaw === 'boolean' ? structurePassedRaw : undefined;
    if (Number.isFinite(scoreN)) {
      const simulation = parseAtsSimulationReport(o.simulation);
      return {
        score: Math.round(scoreN as number),
        compatible: o.compatible === true,
        issues,
        passed,
        ...(methodologyNote ? { methodologyNote } : {}),
        ...(simulation ? { simulation } : {}),
        ...(structureIssues.length > 0 ? { structureIssues } : {}),
        ...(structureScore !== undefined ? { structureScore } : {}),
        ...(structurePassed !== undefined ? { structurePassed } : {}),
      };
    }
  }
  return { score: 0, compatible: true, issues: [], passed: [] };
}

function parseJobMatchSection(raw: unknown): JobMatchSectionScore | undefined {
  if (raw === null || raw === undefined) return undefined;
  const base = parseSectionScore(raw);
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ...base,
      missingSkills: [],
      alignmentInsights: [],
      recommendations: [],
    };
  }
  const o = raw as Record<string, unknown>;
  return {
    ...base,
    missingSkills: parseStringArray(o.missingSkills ?? o.missing_skills),
    alignmentInsights: parseStringArray(
      o.alignmentInsights ?? o.alignment_insights,
    ),
    recommendations: parseStringArray(o.recommendations),
  };
}

function parseImprovementsFromBreakdown(raw: unknown): CVImprovement[] {
  if (!Array.isArray(raw)) return [];
  const out: CVImprovement[] = [];
  for (const x of raw) {
    if (x === null || typeof x !== 'object' || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const issue = String(o.issue ?? o.message ?? '').trim();
    const suggestion = String(o.suggestion ?? '').trim();
    if (!issue && !suggestion) continue;
    let priority = 2 as 1 | 2 | 3;
    if (o.priority === 1 || o.priority === 2 || o.priority === 3)
      priority = o.priority;
    else if (o.severity === 'HIGH') priority = 1;
    else if (o.severity === 'MEDIUM') priority = 2;
    else if (o.severity === 'LOW') priority = 3;
    out.push({
      priority,
      section: String(o.section ?? ''),
      issue: issue || suggestion,
      suggestion: suggestion || issue,
      example: typeof o.example === 'string' ? o.example : undefined,
    });
  }
  return out;
}

function isNewShapeBreakdown(b: Record<string, unknown> | undefined): boolean {
  const s = b?.sections;
  return (
    s !== null &&
    typeof s === 'object' &&
    !Array.isArray(s) &&
    'experience' in (s as object)
  );
}

function normalizeScoreBreakdown(
  breakdown: Record<string, unknown> | undefined,
  ringScore: number,
): CVScoreBreakdown {
  if (isNewShapeBreakdown(breakdown)) {
    const s = breakdown!.sections as Record<string, unknown>;
    const st =
      typeof breakdown!.strengths === 'object' &&
      Array.isArray(breakdown!.strengths)
        ? (breakdown!.strengths as string[]).filter(
            (x) => typeof x === 'string',
          )
        : [];
    const flags: CVFlag[] = Array.isArray(breakdown!.flags)
      ? (breakdown!.flags as unknown[]).filter(
          (f): f is CVFlag => f !== null && typeof f === 'object',
        )
      : [];
    const cs = breakdown!.careerStage;
    const careerStage: CareerStage =
      cs === 'student' || cs === 'early' || cs === 'mid' || cs === 'senior'
        ? cs
        : 'student';
    const overallN =
      breakdown!.overall !== undefined ? Number(breakdown!.overall) : ringScore;
    const jmRaw = s.jobMatch ?? s.job_match;
    const jobMatch =
      jmRaw !== undefined ? parseJobMatchSection(jmRaw) : undefined;
    return {
      overall: Number.isFinite(overallN) ? Math.round(overallN) : ringScore,
      careerStage,
      sections: {
        contact: parseSectionScore(s.contact),
        experience: parseSectionScore(s.experience),
        education: parseSectionScore(s.education),
        skills: parseSectionScore(s.skills),
        summary: parseSectionScore(s.summary),
        formatting: parseSectionScore(s.formatting),
        ...(jobMatch ? { jobMatch } : {}),
      },
      ats: parseAts(breakdown!.ats ?? breakdown!.atsCompatibility),
      flags,
      strengths: st,
      improvements: parseImprovementsFromBreakdown(breakdown!.improvements),
    };
  }

  const legacy = scoreBreakdownFromPayload(breakdown);
  const fb = (n: number) => (n > 0 ? n : Math.round(ringScore / 4));
  return {
    overall: ringScore,
    careerStage: 'student',
    sections: {
      contact: EMPTY_SECTION(),
      experience: { ...EMPTY_SECTION(), score: fb(legacy.experience) },
      education: { ...EMPTY_SECTION(), score: fb(legacy.education) },
      skills: { ...EMPTY_SECTION(), score: fb(legacy.skills) },
      summary: { ...EMPTY_SECTION(), score: fb(legacy.summary) },
      formatting: EMPTY_SECTION(),
    },
    ats: parseAts(breakdown?.atsCompatibility),
    flags: [],
    strengths: [],
    improvements: [],
  };
}

export type CVScoreCardProps = {
  score: number;
  /** Pre-normalized breakdown, or raw API `breakdown` object. */
  breakdown: CVScoreBreakdown | Record<string, unknown> | undefined;
  mode: 'compact' | 'full';
  improvementsCount?: number;
  strengths?: string[];
  improvements?: CVImprovementItem[];
  flags?: { type: 'error' | 'warning' | 'info'; text: string }[];
  /** Ephemeral job-aware score — not persisted as your stored CV score. */
  scorePreview?: boolean;
  /** When true, omits job-match UI (used on CV Clinic analysis). */
  hideJobMatch?: boolean;
  /** Opens CV assistant with a grounded prompt (e.g. ATS missing keywords). */
  onAtsKeywordAssist?: (prompt: string) => void;
  /** Hybrid scoring metadata (from GET/POST score); parsed from `breakdown` when omitted. */
  hybridScoring?: CvHybridScoringMeta | null;
  /** Optional full score payload for hybrid field extraction. */
  scorePayload?: CVScorePayload | null;
  /** CV profile id — enables section explainer actions when set. */
  cvProfileId?: string | null;
  /** Pending suggestions used to link explainers to queue rows. */
  pendingImprovements?: CVImprovementItem[];
  onDiffPreview?: (params: CvDiffPreviewOpenParams | null) => void;
  /** Called after a suggestion action so parents can refetch score. */
  onScoreRefresh?: () => void;
  /** When a diff overlay is open for this suggestion, hide duplicate Fix with AI. */
  activePreviewSuggestionId?: string | null;
};

function CvHybridScoringBlock({
  hybrid,
  overallScore,
  compact,
  showQualityDimensions = true,
}: {
  hybrid: CvHybridScoringMeta;
  overallScore: number;
  compact: boolean;
  showQualityDimensions?: boolean;
}) {
  // AI breakdown unavailable → show a clear heuristic note instead of an empty card.
  if (!hybrid.aiBreakdownAvailable) {
    const structural = hybrid.structuralScore;
    const insufficient =
      hybrid.aiBreakdownUnavailableReason === 'insufficient_content';
    return (
      <div className={cn('mt-3 w-full min-w-0', compact ? 'px-1' : 'px-0.5')}>
        <div
          className={cn(
            'rounded-xl border bg-warning-subtle',
            insufficient ? 'border-accent-border' : 'border-warning-border',
            compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
          )}
        >
          <p
            className={cn(
              'font-medium leading-snug',
              insufficient ? 'text-accent-text' : 'text-warning-text',
              compact ? 'text-[12px]' : 'text-[13px]',
            )}
          >
            {insufficient
              ? 'Add summary, experience, or skills to unlock AI quality analysis. Structural score shown below.'
              : 'AI analysis unavailable. Showing structural checks only.'}
          </p>
          {!insufficient ? (
            <p
              className={cn(
                'mt-1 leading-snug text-text-tertiary',
                compact ? 'text-[11px]' : 'text-[12px]',
              )}
            >
              The AI quality review refreshes automatically once AI is available
              again.
              {structural != null ? ` Structure score: ${structural}/100.` : ''}
            </p>
          ) : structural != null ? (
            <p
              className={cn(
                'mt-1 text-text-tertiary',
                compact ? 'text-[11px]' : 'text-[12px]',
              )}
            >
              Structure score: {structural}/100.
            </p>
          ) : null}
        </div>
      </div>
    );
  }
  const t = hybrid.scoringTransparency;
  const structPct = t?.weights.structuralPercent ?? 30;
  const aiPct = t?.weights.aiPercent ?? 70;
  const weightsSummary =
    hybrid.scoringMethod === 'hybrid'
      ? hybridWeightsSummaryLine(structPct, aiPct)
      : null;
  const weightsTooltip =
    hybrid.scoringMethod === 'hybrid'
      ? hybridWeightsTooltip(structPct, aiPct, t?.weights.short)
      : null;
  const structural =
    hybrid.structuralScore != null ? hybrid.structuralScore : null;
  const ai = hybrid.aiScore != null ? hybrid.aiScore : null;
  const showBlend =
    hybrid.scoringMethod === 'hybrid' && structural != null && ai != null;
  const overallRounded = Math.round(overallScore);
  const blendCompactLine =
    showBlend && structural != null && ai != null
      ? hybridBlendCompactLine(structural, ai, overallRounded)
      : null;
  const formulaExample =
    showBlend && structural != null && ai != null
      ? hybridOverallFormulaExample(
          structural,
          ai,
          structPct,
          aiPct,
          overallRounded,
        )
      : null;
  const showRubricOnlyStructure =
    hybrid.scoringMethod === 'rubric_only' && structural != null;
  const dimensions = hybrid.aiAssessment?.dimensions ?? {};
  const dimensionEntries = Object.entries(dimensions).filter(
    ([, d]) => typeof d.score === 'number',
  );
  const summary = hybrid.aiAssessment?.summary?.trim() ?? '';

  return (
    <div
      className={cn(
        'mt-3 w-full min-w-0 space-y-2.5',
        compact ? 'px-1' : 'px-0.5',
      )}
    >
      <details
        className={cn(
          'group rounded-xl border border-border-subtle bg-bg-surface',
          compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
        )}
      >
        <summary className="flex min-h-[36px] cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold text-text-secondary hover:text-text-primary [&::-webkit-details-marker]:hidden">
          How is this score worked out?
          <span
            aria-hidden
            className="text-text-tertiary transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        {weightsSummary ? (
          <div className="text-center">
            <p
              className={cn(
                'leading-snug text-text-tertiary',
                compact ? 'text-[12px]' : 'text-[13px]',
              )}
            >
              Blended from two scores
            </p>
            <div className="mt-1 flex flex-col items-center justify-center gap-0.5">
              <p
                className={cn(
                  'font-medium tabular-nums text-text-tertiary',
                  compact ? 'text-[11px]' : 'text-[12px]',
                )}
              >
                {weightsSummary}
              </p>
              {weightsTooltip ? (
                <InfoHint
                  text={weightsTooltip}
                  buttonAriaLabel="Where the blend weights come from"
                  tooltipClassName="max-w-[min(20rem,90vw)]"
                  buttonClassName="h-4 w-4"
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {showBlend ? (
          <>
            <div
              className={cn(
                'mt-2 grid grid-cols-3 gap-1 text-center tabular-nums',
                compact ? 'text-[12px]' : 'text-[13px]',
              )}
            >
              <div className="min-w-0 rounded-lg bg-bg-surface px-1 py-1.5">
                <p className="text-[11px] font-medium uppercase leading-tight tracking-wide text-text-tertiary">
                  Structure score
                </p>
                {t?.structural.short ? (
                  <div className="mt-0.5 flex justify-center">
                    <InfoHint
                      text={t.structural.short}
                      buttonAriaLabel="What the structure score measures"
                      tooltipClassName="max-w-[min(18rem,88vw)]"
                      buttonClassName="h-3.5 w-3.5"
                    />
                  </div>
                ) : null}
                <p className="mt-0.5 text-[11px] text-text-disabled">
                  out of 100
                </p>
                <p
                  className="mt-0.5 text-base font-semibold leading-none"
                  style={{ color: sectionScoreBarColor(structural) }}
                >
                  {structural}
                </p>
              </div>
              <div className="min-w-0 rounded-lg bg-bg-surface px-1 py-1.5">
                <p className="text-[11px] font-medium uppercase leading-tight tracking-wide text-text-tertiary">
                  Quality score
                </p>
                {t?.ai.short ? (
                  <div className="mt-0.5 flex justify-center">
                    <InfoHint
                      text={t.ai.short}
                      buttonAriaLabel="What the quality score measures"
                      tooltipClassName="max-w-[min(18rem,88vw)]"
                      buttonClassName="h-3.5 w-3.5"
                    />
                  </div>
                ) : null}
                <p className="mt-0.5 text-[11px] text-text-disabled">
                  out of 100
                </p>
                <p
                  className="mt-0.5 text-base font-semibold leading-none"
                  style={{ color: sectionScoreBarColor(ai) }}
                >
                  {ai}
                </p>
              </div>
              <div className="rounded-lg border border-accent-border bg-accent-subtle px-1.5 py-1.5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-accent-text">
                  Overall score
                </p>
                <p className="mt-0.5 text-[11px] text-accent-text">
                  weighted blend
                </p>
                <p className="mt-0.5 text-base font-semibold leading-none text-text-primary">
                  {Math.round(overallScore)}
                </p>
              </div>
            </div>
            {formulaExample ? (
              <p
                className={cn(
                  'mt-2 text-center font-medium tabular-nums text-text-tertiary',
                  compact ? 'text-[11px]' : 'text-[12px]',
                )}
              >
                How we calculated this: {formulaExample}
              </p>
            ) : null}
          </>
        ) : null}

        {hybrid.aiCached && t?.cache.short ? (
          <div className="mt-2 flex items-center justify-center gap-1.5 border-t border-border-subtle pt-2">
            <span className="text-[12px] font-medium text-text-tertiary">
              Cached quality review
            </span>
            <InfoHint
              text={t.cache.short}
              buttonAriaLabel="About cached quality review"
              tooltipClassName="max-w-[min(18rem,88vw)]"
            />
          </div>
        ) : null}
      </details>

      {summary ? (
        <div
          className={cn(
            'rounded-xl border-l-2 border-accent-border bg-bg-surface py-2 pl-3 pr-2.5',
            compact ? 'text-[12px]' : 'text-[13px]',
          )}
        >
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            AI review
          </p>
          <p className="leading-relaxed text-text-secondary">{summary}</p>
        </div>
      ) : null}

      {showQualityDimensions && dimensionEntries.length > 0 ? (
        <div className="rounded-xl border border-border-subtle bg-bg-surface p-2.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Quality dimensions
          </p>
          <div className="space-y-2">
            {dimensionEntries.map(([key, dim]) => (
              <div
                key={key}
                className="min-w-0"
                title={dim.note?.trim() || undefined}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-text-tertiary',
                      compact ? 'text-[12px]' : 'text-[13px]',
                    )}
                  >
                    {formatAiDimensionLabel(key)}
                  </span>
                  <span
                    className="shrink-0 text-[13px] font-semibold tabular-nums"
                    style={{ color: sectionScoreBarColor(dim.score) }}
                  >
                    {dim.score}
                  </span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(0, dim.score))}%`,
                      background: sectionScoreBarColor(dim.score),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function CVScoreCard({
  score,
  breakdown,
  mode,
  improvementsCount,
  strengths,
  improvements,
  flags,
  scorePreview = false,
  hideJobMatch = false,
  onAtsKeywordAssist,
  hybridScoring,
  scorePayload,
  cvProfileId,
  pendingImprovements = [],
  onDiffPreview,
  onScoreRefresh,
  activePreviewSuggestionId = null,
}: CVScoreCardProps) {
  const raw =
    breakdown !== null && typeof breakdown === 'object'
      ? (breakdown as Record<string, unknown>)
      : undefined;
  const br = normalizeScoreBreakdown(raw, score);
  const hybrid =
    hybridScoring ??
    hybridScoringFromScorePayload(scorePayload ?? null) ??
    parseCvHybridScoring(raw);
  const analysisUiHints =
    parseAnalysisUiHints(raw) ??
    parseAnalysisUiHints(scorePayload?.breakdown) ??
    parseAnalysisUiHints(scorePayload);
  const showQualityDimensions =
    analysisUiHints?.showQualityDimensions !== false;
  // Never render an empty ring: only show the circle when there is a real score.
  const roundedScore = Math.round(score);
  const showScoreRing = roundedScore > 0;
  const atsMode = hybrid?.atsMode ?? 'heuristic';
  const atsIsAiRead = atsMode === 'ai';
  const sectionExplainersRoot = parseBreakdownSectionExplainers(raw);
  const { fixWithAi, fixMyself } = useCvScoreSectionActions(
    cvProfileId,
    onDiffPreview,
    onScoreRefresh,
  );
  const improvementById = useMemo(() => {
    const map = new Map<string, CVImprovementItem>();
    for (const item of pendingImprovements) {
      const id = item.id?.trim();
      if (id) map.set(id, item);
    }
    return map;
  }, [pendingImprovements]);
  const [actionBusy, setActionBusy] = useState<{
    key: CvSectionScoreKey;
    kind: 'ai' | 'self';
  } | null>(null);
  const prevScoreRef = useRef(score);
  const [scoreBump, setScoreBump] = useState(false);

  useEffect(() => {
    if (score > (prevScoreRef.current ?? 0)) {
      setScoreBump(true);
      const t = window.setTimeout(() => setScoreBump(false), 900);
      prevScoreRef.current = score;
      return () => window.clearTimeout(t);
    }
    prevScoreRef.current = score;
  }, [score]);

  const resolveExplainer = (
    key: CvSectionScoreKey,
    section: SectionScore,
  ): CvSectionScoreExplainer | null => {
    const fromSection = section.explainer ?? sectionExplainersRoot[key] ?? null;
    if (fromSection) return fromSection;
    return buildSectionExplainerFallback(section, key, pendingImprovements);
  };

  const runFixWithAi = async (key: CvSectionScoreKey, suggestionId: string) => {
    setActionBusy({ key, kind: 'ai' });
    try {
      await fixWithAi(suggestionId);
    } finally {
      setActionBusy(null);
    }
  };

  const runFixMyself = async (key: CvSectionScoreKey, suggestionId: string) => {
    setActionBusy({ key, kind: 'self' });
    try {
      await fixMyself(suggestionId);
    } finally {
      setActionBusy(null);
    }
  };

  const experienceScore = br.sections?.experience?.score ?? 0;
  const isLikelyParseFailure =
    experienceScore <= 5 && br.careerStage === 'student' && br.overall <= 20;

  const strengthsDisplay =
    br.strengths.length > 0 ? br.strengths : (strengths ?? []);

  const sectionOrder: {
    key: keyof CVScoreBreakdown['sections'];
    label: string;
  }[] = [
    { key: 'experience', label: 'Experience' },
    { key: 'skills', label: 'Skills' },
    { key: 'education', label: 'Education' },
    { key: 'summary', label: 'Summary' },
    { key: 'contact', label: 'Contact' },
    { key: 'formatting', label: 'Formatting' },
  ];

  const showAts = Boolean(
    isNewShapeBreakdown(raw) ||
    raw?.ats !== undefined ||
    raw?.atsCompatibility !== undefined ||
    br.ats.score > 0 ||
    br.ats.issues.length > 0 ||
    br.ats.passed.length > 0 ||
    Boolean(br.ats.simulation) ||
    (br.ats.structureIssues?.length ?? 0) > 0 ||
    br.ats.structureScore != null,
  );

  const jobMatch = br.sections.jobMatch;
  const jobMatchFlags = (br.flags ?? []).filter(
    (f) => (f.section ?? '').toLowerCase() === 'jobmatch',
  );
  const jobMatchFromFlags = {
    missing: jobMatchFlags
      .filter((f) => /skill|keyword|missing/i.test(f.message))
      .map((f) => f.message),
    insights: jobMatchFlags
      .filter((f) => /align|fit|overlap|match/i.test(f.message))
      .map((f) => f.message),
    recs: jobMatchFlags
      .map((f) => f.fix)
      .filter((x) => typeof x === 'string' && x.trim().length > 0) as string[],
  };
  const missingSkillsDisplay =
    jobMatch?.missingSkills && jobMatch.missingSkills.length > 0
      ? jobMatch.missingSkills
      : jobMatchFromFlags.missing.length > 0
        ? jobMatchFromFlags.missing
        : [];
  const alignmentDisplay =
    jobMatch?.alignmentInsights && jobMatch.alignmentInsights.length > 0
      ? jobMatch.alignmentInsights
      : jobMatchFromFlags.insights.length > 0
        ? jobMatchFromFlags.insights
        : [];
  const recommendationsDisplay =
    jobMatch?.recommendations && jobMatch.recommendations.length > 0
      ? jobMatch.recommendations
      : jobMatchFromFlags.recs.length > 0
        ? jobMatchFromFlags.recs
        : [];

  const showJobMatchPanel = Boolean(
    jobMatch &&
    (jobMatch.weight > 0 ||
      jobMatch.score > 0 ||
      missingSkillsDisplay.length > 0),
  );
  const jobMatchSkippedFeedback = jobMatch?.feedback?.trim() ?? '';
  const isJobMatchSkippedBackendNote =
    /job match scoring was skipped/i.test(jobMatchSkippedFeedback) ||
    /no job description or target role was supplied/i.test(
      jobMatchSkippedFeedback,
    );
  const showJobMatchSkippedNote = Boolean(
    jobMatch &&
    jobMatch.weight === 0 &&
    !isJobMatchSkippedBackendNote &&
    (jobMatchSkippedFeedback || (jobMatch.flags?.length ?? 0) > 0),
  );

  const atsHeuristicDisclaimer =
    "These ATS-related items are heuristic checks on structure and text in this product, not a guarantee of how a specific employer's software will score or parse your file.";

  const dedupedAtsIssues =
    analysisUiHints?.structuralAtsChecksPlacement === 'after_ats_read_only' &&
    (br.ats.structureIssues?.length ?? 0) > 0
      ? br.ats.issues.filter((issue) => {
          const norm = issue.trim().toLowerCase();
          return !(br.ats.structureIssues ?? []).some(
            (si) => si.suggestion.trim().toLowerCase() === norm,
          );
        })
      : br.ats.issues;

  const atsSectionTitle = atsIsAiRead
    ? 'ATS read (AI-assisted)'
    : 'ATS read (basic checks)';
  const atsPassedTooltip = atsIsAiRead
    ? 'AI-assisted ATS read of your structure and content. Recommendations are based on common ATS best practices.'
    : 'Formatting appears ATS-friendly for these basic structural checks. Recommendations are based on common ATS best practices.';
  const atsBadgeFriendlyLabel = atsIsAiRead
    ? 'ATS-friendly (AI read)'
    : 'ATS-friendly (basic checks)';

  const atsCompatibilitySection = (compactLayout: boolean) => (
    <div
      className={cn(
        compactLayout
          ? 'mb-4 rounded-lg border border-border-subtle bg-bg-surface p-3'
          : 'mt-5 border-t border-border-subtle pt-4',
      )}
    >
      <div
        className={cn('flex flex-col gap-1', compactLayout ? 'mb-2' : 'mb-3')}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1 sm:max-w-none">
            <span
              className={cn(
                'font-semibold uppercase tracking-widest text-text-tertiary',
                compactLayout ? 'text-[11px]' : 'text-[12px]',
              )}
            >
              {atsSectionTitle}
            </span>
            <InfoHint
              text={[br.ats.methodologyNote?.trim(), atsHeuristicDisclaimer]
                .filter(Boolean)
                .join('\n\n')}
              buttonAriaLabel="About heuristic ATS checks"
              tooltipClassName="max-w-[min(22rem,92vw)]"
            />
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <span
              className={cn('font-bold', compactLayout ? 'text-xs' : 'text-sm')}
              style={{
                color: br.ats.compatible
                  ? 'var(--ck-success-text)'
                  : 'var(--ck-warning-text)',
              }}
            >
              {br.ats.score}/100
            </span>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 font-semibold',
                compactLayout ? 'text-[11px]' : 'text-[12px]',
                br.ats.compatible
                  ? 'bg-success-subtle text-success-text'
                  : 'bg-warning-subtle text-warning-text',
              )}
              title={br.ats.compatible ? atsPassedTooltip : undefined}
            >
              {br.ats.compatible ? atsBadgeFriendlyLabel : 'Suggestions'}
            </span>
          </div>
        </div>
      </div>

      {br.ats.passed.map((check, i) => (
        <div
          key={`p-${i}`}
          className={cn(
            'flex items-start gap-2',
            compactLayout ? 'mb-1.5' : 'mb-2',
          )}
        >
          <span
            className="mt-0.5 shrink-0 text-xs text-success-text"
            title={atsPassedTooltip}
          >
            ✓
          </span>
          <span
            className={cn(
              'min-w-0 break-words leading-relaxed text-text-tertiary',
              compactLayout ? 'text-[12px]' : 'text-xs',
            )}
          >
            {check}
          </span>
        </div>
      ))}

      {dedupedAtsIssues.map((issue, i) => (
        <div
          key={`i-${i}`}
          className={cn(
            'flex items-start gap-2 rounded-lg border border-warning-border bg-warning-subtle',
            compactLayout ? 'mb-1.5 p-2' : 'mb-2 p-2.5',
          )}
        >
          <span className="mt-0.5 shrink-0 text-xs text-warning-text">⚠</span>
          <span
            className={cn(
              'min-w-0 break-words leading-relaxed text-text-secondary',
              compactLayout ? 'text-[12px]' : 'text-xs',
            )}
          >
            {issue}
          </span>
        </div>
      ))}

      {br.ats.structureIssues && br.ats.structureIssues.length > 0 ? (
        <div className={cn(compactLayout ? 'mt-2' : 'mt-3')}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p
              className={cn(
                'font-semibold uppercase tracking-widest text-text-tertiary',
                compactLayout ? 'text-[11px]' : 'text-[12px]',
              )}
            >
              Structural ATS checks
            </p>
            {br.ats.structureScore != null ? (
              <span className="text-[13px] font-semibold tabular-nums text-text-tertiary">
                {br.ats.structureScore}/100
              </span>
            ) : null}
          </div>
          {br.ats.structureIssues.map((issue, i) => {
            const high = String(issue.severity).toLowerCase() === 'high';
            return (
              <div
                key={`struct-${issue.type}-${i}`}
                className={cn(
                  'flex items-start gap-2 rounded-lg border',
                  high
                    ? 'mb-2 border-danger-border bg-danger-subtle p-2.5'
                    : 'mb-2 border-warning-border bg-warning-subtle p-2.5',
                  compactLayout && 'p-2',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 shrink-0 text-xs',
                    high ? 'text-danger-text' : 'text-warning-text',
                  )}
                >
                  ⚠
                </span>
                <div className="min-w-0">
                  {issue.affectedSection ? (
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-text-tertiary">
                      {issue.affectedSection}
                    </p>
                  ) : null}
                  <p
                    className={cn(
                      'leading-relaxed text-text-secondary',
                      compactLayout ? 'text-[12px]' : 'text-xs',
                    )}
                  >
                    {issue.suggestion}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {br.ats.simulation ? (
        <AtsSimulationInsights
          simulation={br.ats.simulation}
          compact={compactLayout}
          onRequestKeywordAssist={onAtsKeywordAssist}
        />
      ) : null}
    </div>
  );

  return (
    <GlowCard
      className={cn('border border-accent-border', 'overflow-x-visible')}
      contentClassName={cn(
        mode === 'compact' ? 'p-2.5 sm:p-3' : 'p-4',
        /* Let section breakdown rows paint to the edge; GlowCard defaults to overflow-x-hidden. */
        'overflow-x-visible',
      )}
    >
      <div
        className={cn('flex flex-col', mode === 'compact' ? 'gap-3' : 'gap-5')}
      >
        <div className="flex shrink-0 flex-col items-center px-2 pb-2 pt-0.5 sm:px-3">
          <div className="mb-2 flex items-center justify-center gap-1">
            <span
              className={cn(
                'font-semibold uppercase tracking-[0.08em] text-text-tertiary',
                mode === 'compact' ? 'text-[11px]' : 'text-[12px]',
              )}
            >
              CV score
            </span>
            {hybrid
              ? (() => {
                  const t = hybrid.scoringTransparency;
                  const hint = [
                    t?.headline,
                    t?.methods[hybrid.scoringMethod]?.short,
                  ]
                    .filter(Boolean)
                    .join('\n\n');
                  return hint ? (
                    <InfoHint
                      text={hint}
                      buttonAriaLabel="How your CV score is calculated"
                      tooltipClassName="max-w-[min(22rem,92vw)]"
                    />
                  ) : null;
                })()
              : null}
          </div>
          {showScoreRing ? (
            <>
              <motion.svg
                width={RING_VIEW}
                height={RING_VIEW}
                viewBox={`0 0 ${RING_VIEW} ${RING_VIEW}`}
                className="shrink-0"
                initial={false}
                animate={scoreBump ? { scale: [1, 1.04, 1] } : false}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <circle
                  cx={RING_CX}
                  cy={RING_CY}
                  r={RING_R}
                  fill="none"
                  stroke="var(--ck-border-default)"
                  strokeWidth={RING_STROKE}
                />
                <circle
                  cx={RING_CX}
                  cy={RING_CY}
                  r={RING_R}
                  fill="none"
                  stroke="var(--ck-accent-solid)"
                  strokeWidth={RING_STROKE}
                  strokeDasharray={RING_C}
                  strokeDashoffset={
                    RING_C * (1 - Math.min(100, Math.max(0, score)) / 100)
                  }
                  strokeLinecap="round"
                  transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
                <text
                  x={RING_CX}
                  y={RING_CY}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--ck-text-primary)"
                  fontSize="24"
                  fontWeight="700"
                >
                  {roundedScore}
                </text>
              </motion.svg>
              <span className="mt-0.5 text-xs text-text-tertiary">/100</span>
            </>
          ) : (
            <div
              className="flex max-w-[15rem] flex-col items-center gap-1.5 rounded-xl border border-border-subtle bg-bg-surface px-3 py-4 text-center"
              role="status"
            >
              <span className="text-[13px] font-semibold text-text-secondary">
                Score not available yet
              </span>
              <span className="text-[12px] leading-snug text-text-tertiary">
                Run a scan to generate your CV score. The AI review appears here
                when it&apos;s ready.
              </span>
            </div>
          )}
          {br.careerStage && !isLikelyParseFailure ? (
            <div className="mt-2 text-center text-[12px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
              {CAREER_STAGE_LABELS[br.careerStage] ?? br.careerStage}
            </div>
          ) : null}
          {isLikelyParseFailure ? (
            <div
              className="mt-2 rounded-md border border-warning-border bg-warning-subtle px-2.5 py-1 text-center text-[13px] text-warning-text"
              role="status"
            >
              CV sections may not have loaded correctly
            </div>
          ) : null}
          {hybrid ? (
            <CvHybridScoringBlock
              hybrid={hybrid}
              overallScore={score}
              compact={mode === 'compact'}
              showQualityDimensions={showQualityDimensions}
            />
          ) : null}
          {scorePreview && !hideJobMatch ? (
            <span className="mt-2 max-w-[14rem] text-center text-[12px] font-semibold leading-snug text-warning-text">
              <span className="rounded-full border border-warning-border bg-warning-subtle px-2 py-0.5">
                Preview (not saved)
              </span>
              <span className="mt-1 block font-normal text-text-tertiary">
                Stored CV score updates only when you run a full scan without
                pasted job text.
              </span>
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 overflow-x-visible border-t border-border-subtle pt-3">
          <p className="mb-2 px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-text-tertiary sm:px-4">
            Section breakdown
          </p>
          <div className="overflow-x-visible rounded-xl border border-border-subtle bg-white/[0.015] py-1">
            {sectionOrder.map(({ key, label }) => {
              const section = br.sections[key];
              if (!section) return null;
              const sectionKey = key as CvSectionScoreKey;
              const explainer = resolveExplainer(sectionKey, section);
              const sc = section.score;
              const w = section.weight;
              const barColor = sectionScoreBarColor(sc);
              const weightPct =
                w !== undefined && w > 0 ? Math.round(w * 100) : null;
              const actionsEnabled = Boolean(
                cvProfileId?.trim() && explainer?.suggestionId,
              );
              const suggestionId = explainer?.suggestionId?.trim();
              const suggestionRow = suggestionId
                ? improvementById.get(suggestionId)
                : undefined;
              const showFixWithAi =
                actionsEnabled &&
                Boolean(
                  suggestionId &&
                  canShowCvImprovementFixWithAI(
                    suggestionRow ?? { id: suggestionId },
                    activePreviewSuggestionId,
                  ),
                );
              return (
                <div
                  key={key}
                  className="box-border w-full min-w-0 px-3 py-1.5 sm:px-4"
                  title={`${label}${weightPct != null ? ` · ${weightPct}% weight` : ''} · ${sc}% score`}
                >
                  <div className="flex w-full min-w-0 items-center gap-1.5 text-[12px] leading-tight sm:gap-2 sm:text-[13px]">
                    <span className="min-w-0 flex-1 truncate text-left font-medium text-text-secondary">
                      {label}
                    </span>
                    {weightPct != null ? (
                      <span className="shrink-0 whitespace-nowrap text-text-tertiary">
                        {weightPct}% weight
                      </span>
                    ) : (
                      <span className="shrink-0 whitespace-nowrap text-text-disabled">
                        —
                      </span>
                    )}
                    <span
                      className="shrink-0 whitespace-nowrap text-right text-[13px] font-semibold tabular-nums sm:text-[12px]"
                      style={{ color: barColor }}
                    >
                      {sc}%
                    </span>
                  </div>
                  <div
                    className="relative mt-1 h-1 w-full min-w-0 overflow-hidden rounded-[4px] bg-bg-surface"
                    aria-hidden
                  >
                    <div
                      className="absolute bottom-0 left-0 top-0 rounded-[4px] transition-[width] duration-500 ease-out"
                      style={{
                        width: `${Math.min(100, Math.max(0, sc))}%`,
                        background: barColor,
                      }}
                    />
                  </div>
                  {explainer ? (
                    <CvScoreSectionExplainer
                      sectionLabel={cvSectionLabel(sectionKey)}
                      score={sc}
                      explainer={explainer}
                      compact={mode === 'compact'}
                      busy={
                        actionBusy?.key === sectionKey ? actionBusy.kind : null
                      }
                      onFixWithAi={
                        showFixWithAi && suggestionId
                          ? (id) => runFixWithAi(sectionKey, id)
                          : undefined
                      }
                      onFixMyself={
                        actionsEnabled
                          ? (id) => runFixMyself(sectionKey, id)
                          : undefined
                      }
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {!hideJobMatch && showJobMatchPanel ? (
            <div className="mt-2 border-t border-border-subtle px-4 pb-1 pt-3">
              <p className="text-[12px] font-medium uppercase tracking-[0.08em] text-text-disabled">
                Job match
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-accent-text">
                {Math.round(jobMatch?.score ?? 0)}%
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-tertiary">
                Heuristic alignment with the job text you provided, not a hiring
                decision or interview guarantee.
              </p>
              {jobMatch?.feedback?.trim() ? (
                <p className="mb-3 text-xs leading-relaxed text-text-secondary">
                  {jobMatch.feedback.trim()}
                </p>
              ) : null}
              {missingSkillsDisplay.length > 0 ? (
                <div className="mb-3">
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Missing or weak keywords
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-[13px] text-text-secondary">
                    {missingSkillsDisplay.map((s, i) => (
                      <li key={`ms-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {alignmentDisplay.length > 0 ? (
                <div className="mb-3">
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Alignment insights
                  </p>
                  <ul className="space-y-1 text-[13px] leading-relaxed text-text-secondary">
                    {alignmentDisplay.map((s, i) => (
                      <li key={`al-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {recommendationsDisplay.length > 0 ? (
                <div>
                  <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Recommendations
                  </p>
                  <ul className="space-y-1 text-[13px] leading-relaxed text-success-text">
                    {recommendationsDisplay.map((s, i) => (
                      <li key={`rc-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {!hideJobMatch &&
          mode === 'full' &&
          showJobMatchSkippedNote &&
          !showJobMatchPanel ? (
            <p className="mt-3 text-[13px] leading-relaxed text-text-tertiary">
              {jobMatch?.feedback?.trim() ||
                'Add a job description (about 40+ characters) or a target role to see job match in your score.'}
            </p>
          ) : null}

          {br.overall <= 20 ? (
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.15)',
                borderRadius: 8,
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--ck-warning-text)',
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                Score may not reflect your actual CV
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.5,
                }}
              >
                If you uploaded a CV, some sections may not have been extracted
                correctly. Re-upload your CV from the CV editor page to get an
                accurate score.
              </p>
            </div>
          ) : null}

          {showAts ? atsCompatibilitySection(mode === 'compact') : null}

          {mode === 'compact' &&
          improvementsCount != null &&
          improvementsCount > 0 ? (
            <p className="mt-4 text-[13px] text-text-tertiary">
              {improvementsCount} improvement
              {improvementsCount === 1 ? '' : 's'} available →
            </p>
          ) : null}
        </div>
      </div>

      {mode === 'full' && strengthsDisplay.length > 0 ? (
        <div className="mt-6 border-t border-border-subtle pt-4">
          <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-success-text/90">
            Strengths
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {strengthsDisplay.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-success-border bg-success-subtle px-2.5 py-1 text-xs text-success-text"
              >
                <Check className="h-3 w-3 shrink-0" strokeWidth={3} />
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {mode === 'full' && flags && flags.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2">
          {flags.map((f, i) => (
            <p
              key={i}
              className={cn(
                'text-xs',
                f.type === 'error'
                  ? 'text-danger-text'
                  : f.type === 'warning'
                    ? 'text-warning-text'
                    : 'text-text-tertiary',
              )}
            >
              {f.text}
            </p>
          ))}
        </div>
      ) : null}
    </GlowCard>
  );
}
