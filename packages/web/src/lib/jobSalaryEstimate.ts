import type { JobSalaryEstimate } from '@/lib/api';

export type JobSalaryEstimateSource = 'job_description' | 'ai_estimate';

function noteImpliesNoPostingBand(est: JobSalaryEstimate): boolean {
  const note = est.note?.trim().toLowerCase() ?? '';
  return note.includes('no specific pay band');
}

export function resolveSalaryEstimateSource(
  est: JobSalaryEstimate,
): JobSalaryEstimateSource {
  if (noteImpliesNoPostingBand(est)) return 'ai_estimate';
  const raw = String(est.source ?? est.dataSource ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'job_description' || raw === 'job_posting' || raw === 'posting') {
    return 'job_description';
  }
  return 'ai_estimate';
}

export function salaryEstimateSourceLabel(est: JobSalaryEstimate): string {
  if (noteImpliesNoPostingBand(est)) return 'AI estimate';
  const label = est.sourceLabel?.trim();
  if (label && !noteImpliesNoPostingBand(est)) return label;
  return resolveSalaryEstimateSource(est) === 'job_description'
    ? 'From job posting'
    : 'AI estimate';
}

export function salaryEstimateSectionTitle(est: JobSalaryEstimate): string {
  return resolveSalaryEstimateSource(est) === 'job_description'
    ? 'Salary range'
    : 'Estimated salary';
}

function localeForSalaryCurrency(code: string): string {
  const c = code.toUpperCase();
  if (c === 'GHS') return 'en-GH';
  if (c === 'NGN') return 'en-NG';
  if (c === 'KES') return 'en-KE';
  if (c === 'ZAR') return 'en-ZA';
  if (c === 'EGP') return 'en-EG';
  if (c === 'GBP') return 'en-GB';
  if (c === 'EUR') return 'en-GB';
  return 'en-US';
}

export function formatSalaryAmount(n: number, currency: string): string {
  const code = currency.trim().toUpperCase() || 'USD';
  const loc = localeForSalaryCurrency(code);
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${code} ${Math.round(n).toLocaleString(loc)}`;
  }
}

function formatSalaryBasisLabel(basis: string | undefined): string {
  const basisRaw = basis?.toLowerCase() ?? 'annual';
  if (basisRaw === 'annual' || basisRaw === 'year' || basisRaw === 'yearly') return 'year';
  if (basisRaw === 'hourly' || basisRaw === 'hour') return 'hour';
  if (basisRaw === 'monthly' || basisRaw === 'month') return 'month';
  return String(basis ?? 'annual').replace(/_/g, ' ');
}

/** Headline range from parsed min/max — never the raw posting excerpt. */
export function formatSalaryRange(est: JobSalaryEstimate): string {
  const a = formatSalaryAmount(est.min, est.currency);
  const b = formatSalaryAmount(est.max, est.currency);
  return `${a} to ${b} / ${formatSalaryBasisLabel(est.basis)}`;
}

const SALARY_POSTING_JUNK_MARKERS = [
  /\bRole Overview\s*:/i,
  /\bAbout (the )?role\s*:/i,
  /\bWe are hiring\b/i,
  /\bResponsibilities\s*:/i,
  /\bJob [Dd]escription\s*:/i,
];

function truncateSalaryPostingExcerpt(text: string): string {
  let cut = text.length;
  for (const marker of SALARY_POSTING_JUNK_MARKERS) {
    const match = text.match(marker);
    if (match?.index != null && match.index > 0 && match.index < cut) {
      cut = match.index;
    }
  }
  return text.slice(0, cut).trim().replace(/[.,;:]+$/, '');
}

/** Verbatim compensation phrase from the posting (body copy, not the headline). */
export function formatSalaryPostingExcerpt(est: JobSalaryEstimate): string | null {
  const raw = est.postingText?.trim();
  if (!raw) return null;
  const excerpt = truncateSalaryPostingExcerpt(raw);
  return excerpt || null;
}

export function formatSalaryRangeCompact(est: JobSalaryEstimate): string {
  const range = formatSalaryRange(est);
  const label = salaryEstimateSourceLabel(est);
  return `${range} · ${label}`;
}

export function isLowConfidenceAiEstimate(est: JobSalaryEstimate): boolean {
  return (
    resolveSalaryEstimateSource(est) === 'ai_estimate' &&
    est.confidence === 'low'
  );
}
