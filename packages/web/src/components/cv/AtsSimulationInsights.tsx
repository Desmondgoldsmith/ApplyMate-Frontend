'use client';

import { Sparkles } from 'lucide-react';

import type { AtsSimulationReport } from '@/lib/atsSimulation';
import { dimensionScoreByHint } from '@/lib/atsSimulation';
import { cn } from '@/lib/utils';

function formatWeightPct(w: number | undefined): string {
  if (w === undefined || !Number.isFinite(w)) return '—';
  if (w >= 0 && w <= 1) return `${Math.round(w * 100)}%`;
  if (w > 1 && w <= 100) return `${Math.round(w)}%`;
  return '—';
}

/** Prefer dimension hint; else ratio of explicit hard-skill match rows. */
function hardSkillsMatchPercent(sim: AtsSimulationReport): number | undefined {
  const fromDim = dimensionScoreByHint(sim.dimensions, ['skill', 'hardskill', 'hard', 'skills']);
  if (fromDim !== undefined) return fromDim;
  const rows = sim.hardSkillMatches;
  if (!rows?.length) return undefined;
  const judged = rows.filter((m) => m.matched === true || m.matched === false);
  if (!judged.length) return undefined;
  const ok = judged.filter((m) => m.matched === true).length;
  return (ok / judged.length) * 100;
}

export type AtsSimulationInsightsProps = {
  simulation: AtsSimulationReport;
  compact?: boolean;
  /** Opens CV assistant with a truthful, grounded prompt for missing terms. */
  onRequestKeywordAssist?: (prompt: string) => void;
};

function pct(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '—';
  return `${Math.round(Math.min(100, Math.max(0, n)))}%`;
}

function MetricCell({
  label,
  value,
  hint,
  compact,
  testId,
}: {
  label: string;
  value: string;
  hint?: string;
  compact?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5',
        compact ? 'min-w-0' : '',
      )}
      title={hint}
    >
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-white/90">{value}</p>
    </div>
  );
}

function collectMissing(sim: AtsSimulationReport): { label: string; words: string[] }[] {
  const out: { label: string; words: string[] }[] = [];
  const k = sim.keywords;
  if (k?.required?.missing?.length) out.push({ label: 'Required', words: k.required.missing });
  if (k?.preferred?.missing?.length) out.push({ label: 'Preferred', words: k.preferred.missing });
  if (k?.niceToHave?.missing?.length) out.push({ label: 'Nice to have', words: k.niceToHave.missing });
  return out;
}

function collectPresent(sim: AtsSimulationReport): { label: string; words: string[] }[] {
  const out: { label: string; words: string[] }[] = [];
  const k = sim.keywords;
  if (k?.required?.present?.length) out.push({ label: 'Required', words: k.required.present });
  if (k?.preferred?.present?.length) out.push({ label: 'Preferred', words: k.preferred.present });
  if (k?.niceToHave?.present?.length) out.push({ label: 'Nice to have', words: k.niceToHave.present });
  return out;
}

export function AtsSimulationInsights({ simulation, compact, onRequestKeywordAssist }: AtsSimulationInsightsProps) {
  const dims = simulation.dimensions;
  const keywordMatch =
    dimensionScoreByHint(dims, ['keyword', 'keywords', 'lexical']) ??
    simulation.coveragePercent ??
    simulation.overallScore;
  const hardSkills = hardSkillsMatchPercent(simulation);
  const title = simulation.titleAlignmentScore ?? dimensionScoreByHint(dims, ['title', 'role']);
  const seniority = simulation.seniorityAlignmentScore ?? dimensionScoreByHint(dims, ['senior', 'level']);
  const semantic = simulation.semanticSimilarityScore ?? dimensionScoreByHint(dims, ['semantic', 'similarity']);
  const formatting =
    simulation.formattingParseabilityScore ?? dimensionScoreByHint(dims, ['format', 'parse', 'layout']);

  const missingGroups = collectMissing(simulation);
  const presentGroups = collectPresent(simulation);
  const missingFlat = missingGroups.flatMap((g) => g.words);
  const topRecommendations = (simulation.recommendations ?? []).slice(0, 8);

  const assistPrompt =
    missingFlat.length > 0
      ? `Using only facts already in my CV, suggest concise edits to naturally incorporate these job-relevant terms where they honestly apply (do not invent employers, dates, tools, or achievements): ${missingFlat
          .slice(0, 14)
          .join(', ')}.`
      : '';

  return (
    <div
      className={cn('space-y-3 border-t border-white/[0.06] pt-3', compact ? 'mt-2' : 'mt-3')}
      data-testid="ats-simulation-root"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#00C9B1]/85">
          ATS simulation (job-aware)
        </p>
        {simulation.overallScore !== undefined ? (
          <span className="text-[10px] tabular-nums text-white/50">
            Model overall {Math.round(simulation.overallScore)}%
            {simulation.coveragePercent !== undefined
              ? ` · Coverage ${Math.round(simulation.coveragePercent)}%`
              : ''}
          </span>
        ) : null}
      </div>

      <div
        className={cn('grid gap-1.5', compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}
        data-testid="ats-simulation-metrics"
      >
        <MetricCell
          label="Keyword match"
          value={pct(keywordMatch)}
          hint="Heuristic overlap between your CV and important terms from the job context."
          compact={compact}
          testId="ats-metric-keyword-match"
        />
        <MetricCell
          label="Hard skills match"
          value={pct(hardSkills)}
          hint="Structured / canonical skill overlap when the simulation provides it."
          compact={compact}
          testId="ats-metric-hard-skills"
        />
        <MetricCell
          label="Title alignment"
          value={pct(title)}
          compact={compact}
          testId="ats-metric-title-alignment"
        />
        <MetricCell
          label="Seniority alignment"
          value={pct(seniority)}
          compact={compact}
          testId="ats-metric-seniority-alignment"
        />
        <MetricCell
          label="Semantic similarity"
          value={pct(semantic)}
          compact={compact}
          testId="ats-metric-semantic-similarity"
        />
        <MetricCell
          label="Formatting / parseability"
          value={pct(formatting)}
          compact={compact}
          testId="ats-metric-formatting"
        />
      </div>

      {dims && Object.keys(dims).length > 0 ? (
        <div className="space-y-1.5" data-testid="ats-simulation-dimensions">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">Dimension weights</p>
          <div className="space-y-1">
            {Object.entries(dims).map(([name, b]) => (
              <div key={name} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[10px] text-white/55" title={name}>
                  {name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-white/45">{formatWeightPct(b.weight)}</span>
                <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-[#00C9B1]/80"
                    style={{ width: `${Math.min(100, Math.max(0, b.score0to100))}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[10px] font-semibold tabular-nums text-white/75">
                  {b.score0to100}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {simulation.hardSkillMatches && simulation.hardSkillMatches.length > 0 ? (
        <div data-testid="ats-hard-skill-matches">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/35">Hard skill signals</p>
          <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px] text-white/60">
            {simulation.hardSkillMatches.slice(0, 24).map((m, i) => (
              <li key={`${m.term ?? i}-${i}`} className="flex flex-wrap gap-1">
                <span className={m.matched === true ? 'text-emerald-300/90' : 'text-amber-200/85'}>
                  {m.matched === true ? '✓' : '○'}
                </span>
                <span>{m.term ?? m.canonical ?? '—'}</span>
                {m.canonical && m.term && m.canonical !== m.term ? (
                  <span className="text-white/35">({m.canonical})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {missingGroups.length > 0 ? (
        <div data-testid="ats-missing-keywords">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-200/90">Missing keywords</p>
            {assistPrompt && onRequestKeywordAssist ? (
              <button
                type="button"
                data-testid="ats-draft-keywords-assistant"
                onClick={() => onRequestKeywordAssist(assistPrompt)}
                className="inline-flex items-center gap-1 rounded-md border border-[#00C9B1]/35 bg-[#00C9B1]/10 px-2 py-0.5 text-[10px] font-semibold text-[#00C9B1] transition hover:bg-[#00C9B1]/15"
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                Draft in Assistant
              </button>
            ) : null}
          </div>
          <p className="mb-1.5 text-[10px] leading-snug text-white/40">
            Prioritized gaps vs the job context. Use Assistant only for truthful wording grounded in your CV.
          </p>
          {missingGroups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="mb-1 text-[10px] font-medium text-white/45">{g.label}</p>
              <div className="flex flex-wrap gap-1">
                {g.words.slice(0, 20).map((w) => (
                  <span
                    key={`${g.label}-${w}`}
                    className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-100/90"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {presentGroups.length > 0 ? (
        <div data-testid="ats-matched-keywords">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-200/85">
            Matched keywords
          </p>
          {presentGroups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="mb-1 text-[10px] font-medium text-white/45">{g.label}</p>
              <div className="flex flex-wrap gap-1">
                {g.words.slice(0, 24).map((w) => (
                  <span
                    key={`${g.label}-${w}`}
                    className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100/90"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {topRecommendations.length > 0 ? (
        <div data-testid="ats-simulation-recommendations">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/35">
            Top ATS actions
          </p>
          <ol className="list-inside list-decimal space-y-1 text-[11px] leading-relaxed text-white/65">
            {topRecommendations.map((r, i) => (
              <li key={`${i}-${r.slice(0, 32)}`}>{r}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
