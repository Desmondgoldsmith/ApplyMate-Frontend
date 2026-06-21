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
  if (score >= 80) return '#00C9B1';
  if (score >= 60) return '#FBBF24';
  return '#F87171';
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
      typeof o.severity === 'string' ? o.severity.trim().toLowerCase() : 'medium';
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
      typeof structureScoreRaw === 'number' && Number.isFinite(structureScoreRaw)
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
    const insufficient = hybrid.aiBreakdownUnavailableReason === 'insufficient_content';
    return (
      <div className={cn('mt-3 w-full min-w-0', compact ? 'px-1' : 'px-0.5')}>
        <div
          className={cn(
            'rounded-xl border bg-amber-500/[0.06]',
            insufficient ? 'border-[#00C9B1]/25' : 'border-amber-500/20',
            compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
          )}
        >
          <p
            className={cn(
              'font-medium leading-snug',
              insufficient ? 'text-[#7ef4e6]' : 'text-amber-100/90',
              compact ? 'text-[10px]' : 'text-[11px]',
            )}
          >
            {insufficient
              ? 'Add summary, experience, or skills to unlock AI quality analysis. Structural score shown below.'
              : 'AI analysis unavailable. Showing structural checks only.'}
          </p>
          {!insufficient ? (
            <p
              className={cn(
                'mt-1 leading-snug text-white/45',
                compact ? 'text-[9px]' : 'text-[10px]',
              )}
            >
              The AI quality review refreshes automatically once AI is available again.
              {structural != null ? ` Structure score: ${structural}/100.` : ''}
            </p>
          ) : structural != null ? (
            <p className={cn('mt-1 text-white/45', compact ? 'text-[9px]' : 'text-[10px]')}>
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
    hybrid.scoringMethod === 'hybrid' &&
    structural != null &&
    ai != null;
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
      <div
        className={cn(
          'rounded-xl border border-white/[0.08] bg-white/[0.03]',
          compact ? 'px-2.5 py-2' : 'px-3 py-2.5',
        )}
      >
        {weightsSummary ? (
          <div className="text-center">
            <p
              className={cn(
                'leading-snug text-white/55',
                compact ? 'text-[10px]' : 'text-[11px]',
              )}
            >
              Blended from two scores
            </p>
            <div className="mt-1 flex flex-col items-center justify-center gap-0.5">
              <p
                className={cn(
                  'font-medium tabular-nums text-white/40',
                  compact ? 'text-[9px]' : 'text-[10px]',
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
                compact ? 'text-[10px]' : 'text-[11px]',
              )}
            >
              <div className="min-w-0 rounded-lg bg-white/[0.04] px-1 py-1.5">
                <p className="text-[9px] font-medium uppercase leading-tight tracking-wide text-white/35">
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
                <p className="mt-0.5 text-[9px] text-white/30">out of 100</p>
                <p
                  className="mt-0.5 text-base font-semibold leading-none"
                  style={{ color: sectionScoreBarColor(structural) }}
                >
                  {structural}
                </p>
              </div>
              <div className="min-w-0 rounded-lg bg-white/[0.04] px-1 py-1.5">
                <p className="text-[9px] font-medium uppercase leading-tight tracking-wide text-white/35">
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
                <p className="mt-0.5 text-[9px] text-white/30">out of 100</p>
                <p
                  className="mt-0.5 text-base font-semibold leading-none"
                  style={{ color: sectionScoreBarColor(ai) }}
                >
                  {ai}
                </p>
              </div>
              <div className="rounded-lg border border-[#00C9B1]/20 bg-[#00C9B1]/[0.06] px-1.5 py-1.5">
                <p className="text-[9px] font-medium uppercase tracking-wide text-[#00C9B1]/80">
                  Overall score
                </p>
                <p className="mt-0.5 text-[9px] text-[#00C9B1]/60">weighted blend</p>
                <p className="mt-0.5 text-base font-semibold leading-none text-white">
                  {Math.round(overallScore)}
                </p>
              </div>
            </div>
            {formulaExample ? (
              <p
                className={cn(
                  'mt-2 text-center font-medium tabular-nums text-white/35',
                  compact ? 'text-[9px]' : 'text-[10px]',
                )}
              >
                How we calculated this: {formulaExample}
              </p>
            ) : null}
          </>
        ) : null}

        {hybrid.aiCached && t?.cache.short ? (
          <div className="mt-2 flex items-center justify-center gap-1.5 border-t border-white/[0.06] pt-2">
            <span className="text-[10px] font-medium text-white/35">
              Cached quality review
            </span>
            <InfoHint
              text={t.cache.short}
              buttonAriaLabel="About cached quality review"
              tooltipClassName="max-w-[min(18rem,88vw)]"
            />
          </div>
        ) : null}
      </div>

      {summary ? (
        <div
          className={cn(
            'rounded-xl border-l-2 border-[#00C9B1]/50 bg-white/[0.03] py-2 pl-3 pr-2.5',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}
        >
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-white/35">
            AI review
          </p>
          <p className="leading-relaxed text-white/60">{summary}</p>
        </div>
      ) : null}

      {showQualityDimensions && dimensionEntries.length > 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
          <p className="mb-2 text-[9px] font-semibold uppercase tracking-wide text-white/35">
            Quality dimensions
          </p>
          <div className="space-y-2">
            {dimensionEntries.map(([key, dim]) => (
              <div key={key} className="min-w-0" title={dim.note?.trim() || undefined}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-white/55',
                      compact ? 'text-[10px]' : 'text-[11px]',
                    )}
                  >
                    {formatAiDimensionLabel(key)}
                  </span>
                  <span
                    className="shrink-0 text-[11px] font-semibold tabular-nums"
                    style={{ color: sectionScoreBarColor(dim.score) }}
                  >
                    {dim.score}
                  </span>
                </div>
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
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
  const showQualityDimensions = analysisUiHints?.showQualityDimensions !== false;
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
          ? 'mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3'
          : 'mt-5 border-t border-white/[0.08] pt-4',
      )}
    >
      <div
        className={cn('flex flex-col gap-1', compactLayout ? 'mb-2' : 'mb-3')}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1 sm:max-w-none">
            <span
              className={cn(
                'font-semibold uppercase tracking-widest text-white/40',
                compactLayout ? 'text-[9px]' : 'text-[10px]',
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
              style={{ color: br.ats.compatible ? '#22C55E' : '#F59E0B' }}
            >
              {br.ats.score}/100
            </span>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 font-semibold',
                compactLayout ? 'text-[9px]' : 'text-[10px]',
                br.ats.compatible
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-amber-500/15 text-amber-400',
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
            className="mt-0.5 shrink-0 text-xs text-green-400"
            title={atsPassedTooltip}
          >
            ✓
          </span>
          <span
            className={cn(
              'min-w-0 break-words leading-relaxed text-white/50',
              compactLayout ? 'text-[10px]' : 'text-xs',
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
            'flex items-start gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.06]',
            compactLayout ? 'mb-1.5 p-2' : 'mb-2 p-2.5',
          )}
        >
          <span className="mt-0.5 shrink-0 text-xs text-amber-400">⚠</span>
          <span
            className={cn(
              'min-w-0 break-words leading-relaxed text-white/60',
              compactLayout ? 'text-[10px]' : 'text-xs',
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
                'font-semibold uppercase tracking-widest text-white/45',
                compactLayout ? 'text-[9px]' : 'text-[10px]',
              )}
            >
              Structural ATS checks
            </p>
            {br.ats.structureScore != null ? (
              <span className="text-[11px] font-semibold tabular-nums text-white/55">
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
                    ? 'mb-2 border-rose-500/20 bg-rose-500/[0.07] p-2.5'
                    : 'mb-2 border-amber-500/15 bg-amber-500/[0.06] p-2.5',
                  compactLayout && 'p-2',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 shrink-0 text-xs',
                    high ? 'text-rose-300' : 'text-amber-400',
                  )}
                >
                  ⚠
                </span>
                <div className="min-w-0">
                  {issue.affectedSection ? (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                      {issue.affectedSection}
                    </p>
                  ) : null}
                  <p
                    className={cn(
                      'leading-relaxed text-white/62',
                      compactLayout ? 'text-[10px]' : 'text-xs',
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
      className={cn(
        'border border-[rgba(0,201,177,0.15)]',
        'overflow-x-visible',
      )}
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
                'font-semibold uppercase tracking-[0.08em] text-white/40',
                mode === 'compact' ? 'text-[9px]' : 'text-[10px]',
              )}
            >
              Resume score
            </span>
            {hybrid ? (
              (() => {
                const t = hybrid.scoringTransparency;
                const hint = [t?.headline, t?.methods[hybrid.scoringMethod]?.short]
                  .filter(Boolean)
                  .join('\n\n');
                return hint ? (
                  <InfoHint
                    text={hint}
                    buttonAriaLabel="How your resume score is calculated"
                    tooltipClassName="max-w-[min(22rem,92vw)]"
                  />
                ) : null;
              })()
            ) : null}
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
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={RING_STROKE}
                />
                <circle
                  cx={RING_CX}
                  cy={RING_CY}
                  r={RING_R}
                  fill="none"
                  stroke="#00C9B1"
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
                  fill="white"
                  fontSize="24"
                  fontWeight="700"
                >
                  {roundedScore}
                </text>
              </motion.svg>
              <span className="mt-0.5 text-xs text-white/40">/100</span>
            </>
          ) : (
            <div
              className="flex max-w-[15rem] flex-col items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-4 text-center"
              role="status"
            >
              <span className="text-[11px] font-semibold text-white/70">
                Score not available yet
              </span>
              <span className="text-[10px] leading-snug text-white/40">
                Run a scan to generate your resume score. The AI review appears
                here when it&apos;s ready.
              </span>
            </div>
          )}
          {br.careerStage && !isLikelyParseFailure ? (
            <div className="mt-2 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-white/35">
              {CAREER_STAGE_LABELS[br.careerStage] ?? br.careerStage}
            </div>
          ) : null}
          {isLikelyParseFailure ? (
            <div
              className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-2.5 py-1 text-center text-[11px] text-amber-200/90"
              role="status"
            >
              Resume sections may not have loaded correctly
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
            <span className="mt-2 max-w-[14rem] text-center text-[10px] font-semibold leading-snug text-amber-200/90">
              <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5">
                Preview (not saved)
              </span>
              <span className="mt-1 block font-normal text-white/40">
                Stored resume score updates only when you run a full scan without
                pasted job text.
              </span>
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 overflow-x-visible border-t border-white/[0.07] pt-3">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35 sm:px-4">
            Section breakdown
          </p>
          <div className="overflow-x-visible rounded-xl border border-white/[0.06] bg-white/[0.015] py-1">
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
              const actionsEnabled = Boolean(cvProfileId?.trim() && explainer?.suggestionId);
              const suggestionId = explainer?.suggestionId?.trim();
              const suggestionRow = suggestionId ? improvementById.get(suggestionId) : undefined;
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
                  <div className="flex w-full min-w-0 items-center gap-1.5 text-[10px] leading-tight sm:gap-2 sm:text-[11px]">
                    <span className="min-w-0 flex-1 truncate text-left font-medium text-[rgba(255,255,255,0.78)]">
                      {label}
                    </span>
                    {weightPct != null ? (
                      <span className="shrink-0 whitespace-nowrap text-[rgba(255,255,255,0.32)]">
                        {weightPct}% weight
                      </span>
                    ) : (
                      <span className="shrink-0 whitespace-nowrap text-[rgba(255,255,255,0.22)]">
                        —
                      </span>
                    )}
                    <span
                      className="shrink-0 whitespace-nowrap text-right text-[11px] font-semibold tabular-nums sm:text-[12px]"
                      style={{ color: barColor }}
                    >
                      {sc}%
                    </span>
                  </div>
                  <div
                    className="relative mt-1 h-1 w-full min-w-0 overflow-hidden rounded-[4px] bg-[rgba(255,255,255,0.08)]"
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
                        actionBusy?.key === sectionKey
                          ? actionBusy.kind
                          : null
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
            <div className="mt-2 border-t border-white/[0.07] px-4 pb-1 pt-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/30">
                Job match
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-[#00C9B1]">
                {Math.round(jobMatch?.score ?? 0)}%
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/35">
                Heuristic alignment with the job text you provided, not a
                hiring decision or interview guarantee.
              </p>
              {jobMatch?.feedback?.trim() ? (
                <p className="mb-3 text-xs leading-relaxed text-white/65">
                  {jobMatch.feedback.trim()}
                </p>
              ) : null}
              {missingSkillsDisplay.length > 0 ? (
                <div className="mb-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Missing or weak keywords
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-[11px] text-white/60">
                    {missingSkillsDisplay.map((s, i) => (
                      <li key={`ms-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {alignmentDisplay.length > 0 ? (
                <div className="mb-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Alignment insights
                  </p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-white/60">
                    {alignmentDisplay.map((s, i) => (
                      <li key={`al-${i}`}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {recommendationsDisplay.length > 0 ? (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    Recommendations
                  </p>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-[#86EFAC]/90">
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
            <p className="mt-3 text-[11px] leading-relaxed text-white/45">
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
                  color: '#F59E0B',
                  marginBottom: 4,
                  fontWeight: 600,
                }}
              >
                Score may not reflect your actual resume
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  lineHeight: 1.5,
                }}
              >
                If you uploaded a resume, some sections may not have been extracted
                correctly. Re-upload your resume from the resume editor page to get an
                accurate score.
              </p>
            </div>
          ) : null}

          {showAts ? atsCompatibilitySection(mode === 'compact') : null}

          {mode === 'compact' &&
          improvementsCount != null &&
          improvementsCount > 0 ? (
            <p className="mt-4 text-[13px] text-white/45">
              {improvementsCount} improvement
              {improvementsCount === 1 ? '' : 's'} available →
            </p>
          ) : null}
        </div>
      </div>

      {mode === 'full' && strengthsDisplay.length > 0 ? (
        <div className="mt-6 border-t border-white/[0.08] pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#22C55E]/90">
            Strengths
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {strengthsDisplay.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-[#22C55E]/35 bg-[#22C55E]/10 px-2.5 py-1 text-xs text-[#86EFAC]"
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
                  ? 'text-[#EF4444]'
                  : f.type === 'warning'
                    ? 'text-[#F59E0B]'
                    : 'text-white/45',
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
