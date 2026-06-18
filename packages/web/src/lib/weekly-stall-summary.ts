import { pickCompanyLogoUrl } from '@/lib/companyLogo';
import { queryKeys } from '@/lib/queryKeys';

import type { TodayPlanCta } from './today-plan';
import { resolveTodayPlanHref } from './today-plan';

/** Root segment for React Query keys — invalidated with `invalidateTodayPlanQueries` (see `today-plan.ts`). */
export const WEEKLY_STALL_SUMMARY_QUERY_ROOT = queryKeys.weeklyStallSummary.root()[0];

const LIMIT_DEFAULT = 5;
const LIMIT_MIN = 1;
const LIMIT_MAX = 20;

export function weeklyStallSummaryQueryKey(params?: { limit?: number }) {
  const raw = params?.limit ?? LIMIT_DEFAULT;
  const limit = Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Number.isFinite(raw) ? raw : LIMIT_DEFAULT));
  return queryKeys.weeklyStallSummary.key(limit);
}

export type WeeklyStallCtaHint = 'OPEN_JOB_HUB' | 'OPEN_JOB_ANALYZE';

export type WeeklyStallItemKind = 'application' | 'analysis' | 'bookmark';

export type WeeklyStallEmptyReason = 'opt_out' | 'paused' | 'no_stalled_rows';

export type WeeklyStallSummaryItem = {
  id: string;
  kind: WeeklyStallItemKind;
  title: string;
  company: string;
  companyLogoUrl?: string | null;
  stage?: string | null;
  applicationId?: string | null;
  jobAnalysisId?: string | null;
  bookmarkId?: string | null;
  stallReasonCodes: string[];
  ctaHint: WeeklyStallCtaHint;
};

export type WeeklyStallSummaryPayload = {
  generatedAt: string;
  digestVersion: string;
  eligible: boolean;
  reasonIfEmpty: WeeklyStallEmptyReason | null;
  items: WeeklyStallSummaryItem[];
  totalCount: number;
  showMoreHref: string;
};

function unwrapEnvelope(raw: unknown): Record<string, unknown> {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.success === true && o.data !== null && typeof o.data === 'object' && !Array.isArray(o.data)) {
      return o.data as Record<string, unknown>;
    }
    return o;
  }
  return {};
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

const CTA_HINTS = new Set<WeeklyStallCtaHint>(['OPEN_JOB_HUB', 'OPEN_JOB_ANALYZE']);
const EMPTY_REASONS = new Set<WeeklyStallEmptyReason>(['opt_out', 'paused', 'no_stalled_rows']);

function parseKind(v: unknown): WeeklyStallItemKind {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (s === 'application' || s === 'analysis' || s === 'bookmark') return s;
  return 'application';
}

function parseCtaHint(v: unknown): WeeklyStallCtaHint {
  const s = typeof v === 'string' ? v.trim().toUpperCase().replace(/-/g, '_') : '';
  if (s === 'OPEN_JOB_HUB' || s === 'OPEN_JOB_ANALYZE') return s;
  return 'OPEN_JOB_HUB';
}

function pickIdsFromBody(o: Record<string, unknown>): {
  applicationId?: string | null;
  jobAnalysisId?: string | null;
  bookmarkId?: string | null;
} {
  const nested = o.ids;
  if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    return {
      applicationId: pickStr(n, 'applicationId', 'application_id') ?? null,
      jobAnalysisId: pickStr(n, 'jobAnalysisId', 'job_analysis_id') ?? null,
      bookmarkId: pickStr(n, 'bookmarkId', 'bookmark_id') ?? null,
    };
  }
  return {
    applicationId: pickStr(o, 'applicationId', 'application_id') ?? null,
    jobAnalysisId: pickStr(o, 'jobAnalysisId', 'job_analysis_id') ?? null,
    bookmarkId: pickStr(o, 'bookmarkId', 'bookmark_id') ?? null,
  };
}

function pickItem(raw: unknown): WeeklyStallSummaryItem | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = pickStr(o, 'id') ?? '';
  if (!id) return null;
  const title = String(pickStr(o, 'title', 'roleTitle') ?? 'Role');
  const company = String(pickStr(o, 'company', 'jobCompany') ?? '');
  const ids = pickIdsFromBody(o);
  const kind = parseKind(o.kind);
  const ctaRaw = o.ctaHint ?? o.cta_hint;
  const ctaHint = CTA_HINTS.has(ctaRaw as WeeklyStallCtaHint)
    ? (ctaRaw as WeeklyStallCtaHint)
    : parseCtaHint(ctaRaw);

  return {
    id,
    kind,
    title,
    company,
    companyLogoUrl: pickCompanyLogoUrl(o),
    stage: o.stage === null ? null : pickStr(o, 'stage') ?? null,
    applicationId: ids.applicationId,
    jobAnalysisId: ids.jobAnalysisId,
    bookmarkId: ids.bookmarkId,
    stallReasonCodes: pickStrArray(o.stallReasonCodes ?? o.stall_reason_codes),
    ctaHint,
  };
}

function pickItemArray(v: unknown): WeeklyStallSummaryItem[] {
  if (!Array.isArray(v)) return [];
  const out: WeeklyStallSummaryItem[] = [];
  for (const el of v) {
    const it = pickItem(el);
    if (it) out.push(it);
  }
  return out;
}

function parseReasonIfEmpty(v: unknown): WeeklyStallEmptyReason | null {
  if (v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  return EMPTY_REASONS.has(s as WeeklyStallEmptyReason) ? (s as WeeklyStallEmptyReason) : null;
}

export function normalizeWeeklyStallSummary(raw: unknown): WeeklyStallSummaryPayload {
  const body = unwrapEnvelope(raw);
  const eligible = body.eligible === true;
  const reasonIfEmpty = parseReasonIfEmpty(body.reasonIfEmpty ?? body.reason_if_empty);
  const showMore =
    pickStr(body, 'showMoreHref', 'show_more_href') ?? '/dashboard/next-moves';
  return {
    generatedAt: String(pickStr(body, 'generatedAt', 'generated_at') ?? new Date().toISOString()),
    digestVersion: String(pickStr(body, 'digestVersion', 'digest_version') ?? ''),
    eligible,
    reasonIfEmpty,
    items: pickItemArray(body.items),
    totalCount: typeof body.totalCount === 'number' && Number.isFinite(body.totalCount) ? body.totalCount : 0,
    showMoreHref: showMore.startsWith('/') ? showMore : `/dashboard/next-moves`,
  };
}

/** Map stall row + `ctaHint` + ids to Job Hub / Analyzer routes (same rules as Today’s Plan CTAs). */
export function weeklyStallItemHref(item: WeeklyStallSummaryItem): string | null {
  const action: Record<string, unknown> = {
    type: item.ctaHint,
  };
  if (item.applicationId) action.applicationId = item.applicationId;
  if (item.jobAnalysisId) action.jobAnalysisId = item.jobAnalysisId;
  if (item.bookmarkId) action.bookmarkId = item.bookmarkId;
  const cta: TodayPlanCta = { label: 'Open', action };
  return resolveTodayPlanHref(cta, { reasonCodes: item.stallReasonCodes });
}

export function clampWeeklyStallLimit(limit?: number): number {
  const n = typeof limit === 'number' && Number.isFinite(limit) ? limit : LIMIT_DEFAULT;
  return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Math.round(n)));
}
