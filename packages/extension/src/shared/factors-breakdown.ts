import type { JobMatchFactor, JobMatchFactorsBreakdown } from '@/shared/types';

function parseStringList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function parseFactor(raw: unknown): JobMatchFactor | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const key = typeof o.key === 'string' ? o.key.trim() : '';
  if (!key) return null;
  const score =
    typeof o.score === 'number' && Number.isFinite(o.score)
      ? Math.max(0, Math.min(100, Math.round(o.score)))
      : 0;
  return {
    key,
    label: typeof o.label === 'string' ? o.label.trim() : key,
    score,
    explanation: typeof o.explanation === 'string' ? o.explanation.trim() : '',
    found: parseStringList(o.found),
    missing: parseStringList(o.missing),
    foundCount: typeof o.foundCount === 'number' ? o.foundCount : undefined,
    totalCount: typeof o.totalCount === 'number' ? o.totalCount : undefined,
  };
}

export function parseFactorsBreakdown(raw: unknown): JobMatchFactorsBreakdown | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const factorsRaw = o.factors;
  if (!Array.isArray(factorsRaw)) return null;
  const factors = factorsRaw
    .map(parseFactor)
    .filter((f): f is JobMatchFactor => f != null);
  return factors.length > 0 ? { factors } : null;
}

export function factorByKey(
  breakdown: JobMatchFactorsBreakdown | null | undefined,
  key: string,
): JobMatchFactor | null {
  return breakdown?.factors.find((f) => f.key === key) ?? null;
}

export function warnFactorScoreInconsistency(factor: JobMatchFactor): void {
  const foundCount = factor.found?.length ?? 0;
  if (foundCount > 0 && factor.score === 0) {
    console.warn(
      `[extension] Inconsistent factor "${factor.key}": ${foundCount} found chips but score is 0%. Re-analyze if the UI looks wrong.`,
    );
  }
}
