'use client';

import { Check } from 'lucide-react';

import { GlowCard } from '@/components/ui/GlowCard';
import { InfoHint } from '@/components/ui/InfoHint';
import { cn } from '@/lib/utils';
import type {
  ATSCompatibility,
  CareerStage,
  CVFlag,
  CVImprovement,
  CVImprovementItem,
  CVScoreBreakdown,
  JobMatchSectionScore,
  SectionScore,
} from '@/lib/api';
import { AtsSimulationInsights } from '@/components/cv/AtsSimulationInsights';
import { parseAtsSimulationReport } from '@/lib/atsSimulation';
import { scoreBreakdownFromPayload } from '@/lib/cvBuilder';

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
  if (
    raw !== null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'score' in (raw as object)
  ) {
    const o = raw as Record<string, unknown>;
    const sc = Number(o.score);
    const w = o.weight !== undefined ? Number(o.weight) : NaN;
    const flags: CVFlag[] = Array.isArray(o.flags)
      ? (o.flags as unknown[]).filter(
          (f): f is CVFlag => f !== null && typeof f === 'object',
        )
      : [];
    return {
      score: Number.isFinite(sc) ? Math.round(sc) : 0,
      weight: Number.isFinite(w) ? w : 0,
      feedback: typeof o.feedback === 'string' ? o.feedback : '',
      flags,
    };
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { score: Math.round(raw), weight: 0, feedback: '', flags: [] };
  }
  return EMPTY_SECTION();
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim());
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
    if (Number.isFinite(scoreN)) {
      const simulation = parseAtsSimulationReport(o.simulation);
      return {
        score: Math.round(scoreN as number),
        compatible: o.compatible === true,
        issues,
        passed,
        ...(methodologyNote ? { methodologyNote } : {}),
        ...(simulation ? { simulation } : {}),
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
};

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
}: CVScoreCardProps) {
  const raw =
    breakdown !== null && typeof breakdown === 'object'
      ? (breakdown as Record<string, unknown>)
      : undefined;
  const br = normalizeScoreBreakdown(raw, score);

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
    Boolean(br.ats.simulation),
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
    "These ATS-related items are heuristic checks on structure and text in this product — not a guarantee of how a specific employer's software will score or parse your file.";

  const atsSectionTitle = 'Heuristic ATS analysis';
  const atsPassedTooltip =
    'Formatting appears ATS-friendly for these heuristic checks. Recommendations are based on common ATS best practices.';

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
              {br.ats.compatible ? 'ATS-friendly (heuristic)' : 'Suggestions'}
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

      {br.ats.issues.map((issue, i) => (
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
          {br.careerStage && !isLikelyParseFailure ? (
            <div className="mb-2 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-white/35">
              {CAREER_STAGE_LABELS[br.careerStage] ?? br.careerStage}
            </div>
          ) : null}
          {isLikelyParseFailure ? (
            <div
              style={{
                fontSize: 11,
                color: '#F59E0B',
                textAlign: 'center',
                marginBottom: 8,
                padding: '4px 10px',
                background: 'rgba(245,158,11,0.08)',
                borderRadius: 6,
                border: '1px solid rgba(245,158,11,0.2)',
              }}
            >
              CV sections may not have loaded correctly
            </div>
          ) : null}
          <svg
            width={RING_VIEW}
            height={RING_VIEW}
            viewBox={`0 0 ${RING_VIEW} ${RING_VIEW}`}
            className="shrink-0"
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
              {Math.round(score)}
            </text>
          </svg>
          <span className="mt-0.5 text-xs text-white/40">/100</span>
          {scorePreview && !hideJobMatch ? (
            <span className="mt-2 max-w-[14rem] text-center text-[10px] font-semibold leading-snug text-amber-200/90">
              <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5">
                Preview (not saved)
              </span>
              <span className="mt-1 block font-normal text-white/40">
                Stored CV score updates only when you run a full scan without
                pasted job text.
              </span>
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 overflow-x-visible">
          <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-white/30 sm:px-4">
            Section breakdown
          </p>
          <div className="overflow-x-visible">
            {sectionOrder.map(({ key, label }) => {
              const section = br.sections[key];
              if (!section) return null;
              const sc = section.score;
              const w = section.weight;
              const barColor = sectionScoreBarColor(sc);
              const weightPct =
                w !== undefined && w > 0 ? Math.round(w * 100) : null;
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
                Heuristic alignment with the job text you provided — not a
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
