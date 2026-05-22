import type { JobListingDto } from '@/lib/api';

/** Human-readable “posted” age for metadata row (e.g. `1d`, `3w`). */
export function formatJobPostedAgo(datePosted?: string): string {
  if (!datePosted?.trim()) return '';
  const d = new Date(datePosted);
  if (Number.isNaN(d.getTime())) return '';
  const ms = Date.now() - d.getTime();
  if (ms < 0) return '';
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1w';
  if (weeks < 8) return `${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${Math.max(1, months)}mo`;
  return `${Math.floor(days / 365)}y`;
}

const SALARY_PATTERNS: RegExp[] = [
  /\bUS\$[\d,]+(?:\s*-\s*US\$?[\d,]+)?/i,
  /\$[\d,]+(?:\s*-\s*\$?[\d,]+)?(?:\s*(?:USD|usd))?/,
  /£[\d,]+(?:\s*-\s*£?[\d,]+)?/,
  /€[\d,]+(?:\s*-\s*€?[\d,]+)?/,
  /\b(?:USD|EUR|GBP)\s*[\d,]+(?:\s*-\s*[\d,]+)?/i,
  /\b[\d,]+k(?:\s*-\s*[\d,]+k)?\s*(?:USD|GBP|EUR)?/i,
];

/** Prefer API `salary`; otherwise scan description for common salary strings. */
export function extractSalaryDisplay(job: Pick<JobListingDto, 'salary' | 'description'>): string | undefined {
  const s = job.salary?.trim();
  if (s) return s;
  const desc = job.description ?? '';
  if (!desc.trim()) return undefined;
  for (const re of SALARY_PATTERNS) {
    const m = desc.match(re);
    if (m?.[0]) return m[0].trim();
  }
  return undefined;
}

function titleHintsRemote(title: string): boolean {
  return /\bremote\b/i.test(title) || /\((?:fully\s+)?remote\)/i.test(title);
}

/** Short label for metadata row: `Remote`, `Hybrid`, `On-site`, or trimmed location. */
export function inferWorkStyleLabel(job: Pick<JobListingDto, 'workMode' | 'location' | 'title' | 'description'>): string {
  const wm = (job.workMode ?? '').trim().toLowerCase();
  if (wm.includes('remote') || wm === 'remote') return 'Remote';
  if (wm.includes('hybrid')) return 'Hybrid';
  if (wm.includes('onsite') || wm.includes('on-site') || wm.includes('in office')) return 'On-site';
  const loc = (job.location ?? '').trim();
  const desc = (job.description ?? '').toLowerCase();
  if (titleHintsRemote(job.title ?? '') || /\bfully\s+remote\b/i.test(desc) || /\b100%\s*remote\b/i.test(desc)) {
    return 'Remote';
  }
  if (/\bhybrid\b/i.test(desc)) return 'Hybrid';
  if (loc) return loc;
  return 'Location TBD';
}

export type JobDescriptionSections = {
  about: string;
  requirements: string | null;
};

/**
 * Split long JD into “about” vs “requirements” when headings exist; otherwise first block vs rest.
 */
export function splitJobDescriptionSections(description: string): JobDescriptionSections {
  const text = (description ?? '').trim();
  if (!text) return { about: '', requirements: null };

  const reqSplit = text.split(
    /(?:\r?\n)\s*(?:Requirements|Qualifications|What\s+you(?:'|’)?ll\s+(?:do|bring)|Must\s+have|Skills\s+required)\s*:?\s*(?:\r?\n)/i,
  );
  if (reqSplit.length >= 2) {
    const about = reqSplit[0]!.trim();
    const requirements = reqSplit.slice(1).join('\n').trim();
    return { about, requirements: requirements || null };
  }

  const paras = text.split(/\n{2,}/);
  if (paras.length >= 2) {
    return { about: paras[0]!.trim(), requirements: paras.slice(1).join('\n\n').trim() || null };
  }

  return { about: text, requirements: null };
}

export function buildJobMetadataParts(job: JobListingDto): string[] {
  const parts: string[] = [];
  const ago = formatJobPostedAgo(job.datePosted);
  if (ago) parts.push(ago);
  const salary = extractSalaryDisplay(job);
  if (salary) parts.push(salary);
  parts.push(inferWorkStyleLabel(job));
  return parts;
}
