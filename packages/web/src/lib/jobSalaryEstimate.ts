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

export function formatSalaryRange(est: JobSalaryEstimate): string {
  const a = formatSalaryAmount(est.min, est.currency);
  const b = formatSalaryAmount(est.max, est.currency);
  const basis =
    est.basis?.toLowerCase() === 'annual' || !est.basis
      ? 'year'
      : String(est.basis).replace(/_/g, ' ');
  return `${a} – ${b} / ${basis}`;
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
