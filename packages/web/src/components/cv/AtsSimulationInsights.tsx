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

/** Prefer hardSkillsMatch dimension; else ratio of explicit hard-skill match rows. */
function hardSkillsMatchPercent(sim: AtsSimulationReport): number | undefined {
  const fromDim = dimensionScoreByHint(sim.dimensions, [
    'hardskillsmatch',
    'hardskillmatch',
    'hardskills',
    'hardskill',
  ]);
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
        'rounded-lg border border-border-subtle bg-bg-surface px-2 py-1.5',
        compact ? 'min-w-0' : '',
      )}
      title={hint}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold tabular-nums text-text-primary">
        {value}
      </p>
    </div>
  );
}

function collectMissing(
  sim: AtsSimulationReport,
): { label: string; words: string[] }[] {
  const out: { label: string; words: string[] }[] = [];
  const k = sim.keywords;
  if (k?.required?.missing?.length)
    out.push({ label: 'Required', words: k.required.missing });
  if (k?.preferred?.missing?.length)
    out.push({ label: 'Preferred', words: k.preferred.missing });
  if (k?.niceToHave?.missing?.length)
    out.push({ label: 'Nice to have', words: k.niceToHave.missing });
  return out;
}

function collectPresent(
  sim: AtsSimulationReport,
): { label: string; words: string[] }[] {
  const out: { label: string; words: string[] }[] = [];
  const k = sim.keywords;
  if (k?.required?.present?.length)
    out.push({ label: 'Required', words: k.required.present });
  if (k?.preferred?.present?.length)
    out.push({ label: 'Preferred', words: k.preferred.present });
  if (k?.niceToHave?.present?.length)
    out.push({ label: 'Nice to have', words: k.niceToHave.present });
  return out;
}

export function AtsSimulationInsights({
  simulation,
  compact,
  onRequestKeywordAssist,
}: AtsSimulationInsightsProps) {
  const dims = simulation.dimensions;
  const keywordMatch =
    dimensionScoreByHint(dims, [
      'keywordmatch',
      'keyword',
      'keywords',
      'lexical',
    ]) ??
    simulation.coveragePercent ??
    simulation.overallScore;
  const hardSkills = hardSkillsMatchPercent(simulation);
  const title =
    simulation.titleAlignmentScore ??
    dimensionScoreByHint(dims, ['title', 'role']);
  const seniority =
    simulation.seniorityAlignment?.score0to100 ??
    simulation.seniorityAlignmentScore ??
    dimensionScoreByHint(dims, ['senior', 'level']);
  const seniorityDetail = simulation.seniorityAlignment?.detail?.trim();
  const semantic =
    simulation.semanticSimilarityScore ??
    dimensionScoreByHint(dims, ['semantic', 'similarity']);
  const formatting =
    simulation.formattingParseabilityScore ??
    dimensionScoreByHint(dims, ['format', 'parse', 'layout']);

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
      className={cn(
        'space-y-3 border-t border-border-subtle pt-3',
        compact ? 'mt-2' : 'mt-3',
      )}
      data-testid="ats-simulation-root"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-accent-text">
          ATS simulation (job-aware)
        </p>
        {simulation.overallScore !== undefined ? (
          <span className="text-[12px] tabular-nums text-text-tertiary">
            Model overall {Math.round(simulation.overallScore)}%
            {simulation.coveragePercent !== undefined
              ? ` · Coverage ${Math.round(simulation.coveragePercent)}%`
              : ''}
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          'grid gap-1.5',
          compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3',
        )}
        data-testid="ats-simulation-metrics"
      >
        <MetricCell
          label="Keyword match"
          value={pct(keywordMatch)}
          hint="Lexical overlap between your CV text and important terms from the job description."
          compact={compact}
          testId="ats-metric-keyword-match"
        />
        <MetricCell
          label="Hard skills match"
          value={pct(hardSkills)}
          hint="Canonical skill entities from the job vs your skills section — may differ from keyword match."
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
          hint={
            seniorityDetail ||
            'How your experience level and title read vs the role.'
          }
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

      {seniorityDetail ? (
        <p
          className="text-[13px] leading-relaxed text-text-tertiary"
          data-testid="ats-seniority-detail"
        >
          {seniorityDetail}
        </p>
      ) : null}

      {dims && Object.keys(dims).length > 0 ? (
        <div className="space-y-1.5" data-testid="ats-simulation-dimensions">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Dimension weights
          </p>
          <div className="space-y-1">
            {Object.entries(dims).map(([name, b]) => (
              <div key={name} className="flex items-center gap-2">
                <span
                  className="min-w-0 flex-1 truncate text-[12px] text-text-tertiary"
                  title={name}
                >
                  {name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-text-tertiary">
                  {formatWeightPct(b.weight)}
                </span>
                <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-bg-hover">
                  <div
                    className="h-full rounded-full bg-accent-subtle"
                    style={{
                      width: `${Math.min(100, Math.max(0, b.score0to100))}%`,
                    }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[12px] font-semibold tabular-nums text-text-secondary">
                  {b.score0to100}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {simulation.hardSkillMatches && simulation.hardSkillMatches.length > 0 ? (
        <div data-testid="ats-hard-skill-matches">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Hard skill ontology matches
          </p>
          <p className="mb-1.5 text-[12px] leading-snug text-white/38">
            Canonical skills from the job — separate from lexical keyword hits
            above.
          </p>
          <ul className="max-h-28 space-y-1 overflow-y-auto text-[13px] text-text-secondary">
            {simulation.hardSkillMatches.slice(0, 24).map((m, i) => (
              <li key={`${m.term ?? i}-${i}`} className="flex flex-wrap gap-1">
                <span
                  className={
                    m.matched === true
                      ? 'text-success-text'
                      : 'text-warning-text'
                  }
                >
                  {m.matched === true ? '✓' : '○'}
                </span>
                <span>{m.term ?? m.canonical ?? '—'}</span>
                {m.canonical && m.term && m.canonical !== m.term ? (
                  <span className="text-text-tertiary">({m.canonical})</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {missingGroups.length > 0 ? (
        <div data-testid="ats-missing-keywords">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-warning-text">
              Missing keywords (lexical)
            </p>
            {assistPrompt && onRequestKeywordAssist ? (
              <button
                type="button"
                data-testid="ats-draft-keywords-assistant"
                onClick={() => onRequestKeywordAssist(assistPrompt)}
                className="inline-flex items-center gap-1 rounded-md border border-accent-border bg-accent-subtle px-2 py-0.5 text-[12px] font-semibold text-accent-text transition hover:bg-accent-subtle"
              >
                <Sparkles className="h-3 w-3" aria-hidden />
                Draft in Assistant
              </button>
            ) : null}
          </div>
          <p className="mb-1.5 text-[12px] leading-snug text-text-tertiary">
            JD token/phrase gaps vs your CV text. Hard skill ontology matches
            are listed separately.
          </p>
          {missingGroups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="mb-1 text-[12px] font-medium text-text-tertiary">
                {g.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {g.words.slice(0, 20).map((w) => (
                  <span
                    key={`${g.label}-${w}`}
                    className="rounded-full border border-warning-border bg-warning-subtle px-2 py-0.5 text-[12px] text-warning-text"
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
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-success-text">
            Matched keywords
          </p>
          {presentGroups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="mb-1 text-[12px] font-medium text-text-tertiary">
                {g.label}
              </p>
              <div className="flex flex-wrap gap-1">
                {g.words.slice(0, 24).map((w) => (
                  <span
                    key={`${g.label}-${w}`}
                    className="rounded-full border border-success-border bg-success-subtle px-2 py-0.5 text-[12px] text-success-text"
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
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Top ATS actions
          </p>
          <ol className="list-inside list-decimal space-y-1 text-[13px] leading-relaxed text-text-secondary">
            {topRecommendations.map((r, i) => (
              <li key={`${i}-${r.slice(0, 32)}`}>{r}</li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
