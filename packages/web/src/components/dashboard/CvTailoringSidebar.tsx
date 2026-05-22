'use client';

import { Check, FileDown, Loader2, RotateCcw, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useQueryClient } from '@tanstack/react-query';

import { TailorCvBuilderPane } from '@/components/cv/TailorCvBuilderPane';
import { TailorChangeHighlights } from '@/components/dashboard/TailorChangeHighlights';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useExportCV } from '@/hooks/useExportCV';
import { useCVProfileById } from '@/hooks/useCVProfileById';
import { inferCvProfileNameFromProfile } from '@/lib/infer-cv-profile-name';
import { buildCvNamingForExport } from '@/lib/cv-profile-naming';
import { api, type CvTailorDraft, type CvTailorDraftEntry, type TailorMutationResponse } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { isCvTemplateId } from '@/lib/cvBuilder';
import { rehydrateCvBuilderAfterStructuredPersist } from '@/lib/cvStructuredDraftCommit';
import { tailorSectionTypeToBuilderId } from '@/lib/tailorSectionMap';
import { cn } from '@/lib/utils';

function tryParseSectionJson(raw: string): unknown {
  const t = raw?.trim() ?? '';
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    return null;
  }
}

function labelizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function SkillPills({ skills, variant }: { skills: string[]; variant: 'before' | 'after' }) {
  if (skills.length === 0) {
    return <span className="text-xs text-white/35">No skills listed</span>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((s) => (
        <Badge
          key={s}
          variant={variant === 'before' ? 'muted' : 'teal'}
          className="max-w-full truncate border px-2.5 py-1 text-[11px] font-medium"
        >
          {s}
        </Badge>
      ))}
    </div>
  );
}

function renderSkillsPayload(data: unknown, variant: 'before' | 'after'): ReactNode {
  if (data === null || data === undefined) {
    return <span className="text-xs text-white/35">Empty</span>;
  }

  if (typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.categories)) {
      return (
        <div className="space-y-3">
          {o.categories.map((cat, i) => {
            if (!cat || typeof cat !== 'object') return null;
            const c = cat as Record<string, unknown>;
            const name = typeof c.name === 'string' ? c.name : `Group ${i + 1}`;
            const skills = Array.isArray(c.skills)
              ? c.skills.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
              : [];
            return (
              <div key={`${name}-${i}`}>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-white/55">{name}</p>
                <SkillPills skills={skills} variant={variant} />
              </div>
            );
          })}
        </div>
      );
    }

    if (Array.isArray(o.skills)) {
      const name = typeof o.name === 'string' && o.name.trim() ? o.name : 'Skills';
      const skills = o.skills.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
      return (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-white/55">{name}</p>
          <SkillPills skills={skills} variant={variant} />
        </div>
      );
    }
  }

  if (Array.isArray(data) && data.every((x) => typeof x === 'string')) {
    return <SkillPills skills={data as string[]} variant={variant} />;
  }

  return null;
}

function renderSummaryPayload(data: unknown): ReactNode {
  if (data === null || data === undefined) return <span className="text-xs text-white/35">Empty</span>;
  if (typeof data === 'string') {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{data}</p>;
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const t = (data as { text?: unknown; summary?: unknown }).text ?? (data as { summary?: unknown }).summary;
    if (typeof t === 'string') {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{t}</p>;
    }
  }
  return null;
}

function renderPersonalPayload(data: unknown): ReactNode {
  if (data === null || data === undefined || typeof data !== 'object' || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const keys = ['name', 'email', 'phone', 'location', 'headline', 'website', 'linkedin', 'github', 'portfolio'];
  const rows: { label: string; value: string }[] = [];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) rows.push({ label: labelizeKey(k), value: v.trim() });
  }
  if (rows.length === 0) {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && v.trim() && !['extras'].includes(k)) {
        rows.push({ label: labelizeKey(k), value: v.trim() });
      }
    }
  }
  if (rows.length === 0) return null;
  return (
    <dl className="space-y-2 text-xs">
      {rows.map(({ label, value }) => (
        <div key={label}>
          <dt className="font-semibold text-white/45">{label}</dt>
          <dd className="mt-0.5 text-white/80">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function renderExperiencePayload(data: unknown): ReactNode {
  if (data === null || data === undefined || typeof data !== 'object') return null;
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ul className="space-y-3 text-xs">
      {items.map((it, i) => {
        if (!it || typeof it !== 'object') return null;
        const x = it as Record<string, unknown>;
        const title = typeof x.title === 'string' ? x.title : 'Role';
        const company = typeof x.company === 'string' ? x.company : '';
        const bullets = Array.isArray(x.bullets)
          ? x.bullets.filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
          : [];
        return (
          <li key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
            <p className="font-semibold text-white">{title}</p>
            {company ? <p className="text-white/50">{company}</p> : null}
            {bullets.length > 0 ? (
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-white/70">
                {bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function renderEducationPayload(data: unknown): ReactNode {
  if (data === null || data === undefined || typeof data !== 'object') return null;
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ul className="space-y-2 text-xs">
      {items.map((it, i) => {
        if (!it || typeof it !== 'object') return null;
        const x = it as Record<string, unknown>;
        const degree = typeof x.degree === 'string' ? x.degree : '';
        const school = typeof x.school === 'string' ? x.school : '';
        const field = typeof x.field === 'string' ? x.field : '';
        return (
          <li key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
            <p className="font-semibold text-white">{[degree, field].filter(Boolean).join(' · ') || 'Education'}</p>
            {school ? <p className="text-white/55">{school}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

function renderGenericObject(data: Record<string, unknown>, depth: number): ReactNode {
  if (depth > 2) {
    return (
      <p className="break-words font-mono text-[10px] text-white/50">
        {JSON.stringify(data).slice(0, 280)}
        {JSON.stringify(data).length > 280 ? '…' : ''}
      </p>
    );
  }
  const entries = Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return <span className="text-xs text-white/35">Empty</span>;
  return (
    <dl className="space-y-2 text-xs">
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className="font-semibold text-white/45">{labelizeKey(k)}</dt>
          <dd className="mt-0.5 break-words text-white/75">
            {typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? (
              String(v)
            ) : Array.isArray(v) ? (
              v.every((x) => typeof x === 'string') ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {(v as string[]).map((s) => (
                    <Badge key={s} variant="muted" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <ul className="mt-1 list-inside list-disc space-y-0.5 text-white/65">
                  {v.slice(0, 8).map((item, i) => (
                    <li key={i}>
                      {typeof item === 'object' && item !== null
                        ? renderGenericObject(item as Record<string, unknown>, depth + 1)
                        : String(item)}
                    </li>
                  ))}
                </ul>
              )
            ) : typeof v === 'object' && v !== null ? (
              <div className="mt-1 rounded border border-white/[0.06] bg-black/20 p-2">
                {renderGenericObject(v as Record<string, unknown>, depth + 1)}
              </div>
            ) : (
              '—'
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FriendlySectionPayload({
  sectionType,
  raw,
  variant,
}: {
  sectionType: string;
  raw: string;
  variant: 'before' | 'after';
}): ReactNode {
  const parsed = tryParseSectionJson(raw);
  const st = sectionType?.trim().toLowerCase() ?? '';

  if (parsed === null && raw.trim() === '') {
    return <span className="text-xs text-white/35">Empty</span>;
  }
  if (parsed === null) {
    return <p className="whitespace-pre-wrap text-sm text-white/75">{raw}</p>;
  }

  if (st === 'skills' || st === 'skill') {
    const skillsView = renderSkillsPayload(parsed, variant);
    if (skillsView) return skillsView;
  }
  if (st === 'summary') {
    const s = renderSummaryPayload(parsed);
    if (s) return s;
  }
  if (st === 'personal' || st === 'contact') {
    const p = renderPersonalPayload(parsed);
    if (p) return p;
  }
  if (st === 'experience' || st === 'work') {
    const e = renderExperiencePayload(parsed);
    if (e) return e;
  }
  if (st === 'education') {
    const ed = renderEducationPayload(parsed);
    if (ed) return ed;
  }

  if (typeof parsed === 'string') {
    return <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">{parsed}</p>;
  }
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    const skillsRetry = renderSkillsPayload(parsed, variant);
    if (skillsRetry) return skillsRetry;
    return renderGenericObject(parsed as Record<string, unknown>, 0);
  }
  if (Array.isArray(parsed)) {
    const strings = parsed.filter((x): x is string => typeof x === 'string');
    if (strings.length === parsed.length) {
      return <SkillPills skills={strings} variant={variant} />;
    }
    return (
      <ul className="space-y-2 text-xs">
        {parsed.map((item, i) => (
          <li key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
            {typeof item === 'object' && item !== null && !Array.isArray(item) ? (
              renderGenericObject(item as Record<string, unknown>, 0)
            ) : (
              <span className="text-white/75">{String(item)}</span>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="break-words text-xs leading-relaxed text-white/55">
      {typeof parsed === 'number' || typeof parsed === 'boolean' ? String(parsed) : JSON.stringify(parsed)}
    </p>
  );
}

function sectionTitle(sectionType: string): string {
  const s = sectionType?.trim() || 'section';
  return `${s.charAt(0).toUpperCase()}${s.slice(1)} section`;
}

export type CvTailoringSidebarProps = {
  open: boolean;
  onClose: () => void;
  draft: CvTailorDraft | null;
  /** Accept/reject/revert responses — includes refreshed `jobAnalysis` when the API returns it. */
  onTailorMutation: (result: TailorMutationResponse) => void;
  jobTitle?: string | null;
  jobCompany?: string | null;
  /** CV template id for export (from profile row or legacy profile). */
  exportTemplate?: string | null;
  /** Called after a tailoring accept persists to the CV (debounced rematch on Jobs page). */
  onTailoringCvPersisted?: () => void;
  /** Fired when a single section is accepted — used to highlight the CV builder section. */
  onSectionAccepted?: (sectionType: string) => void;
  /** Pre/post match scores after tailoring + rematch (Jobs page). */
  scoreBeforeTailor?: number | null;
  currentScore?: number | null;
  tailoredCvName?: string | null;
  /** Saved job analysis — enables tailored export filename on GET …/export/pdf?jobAnalysisId= */
  jobAnalysisId?: string | null;
  /** drawer = narrow right panel; split = full-screen with CV builder on the left. */
  layout?: 'drawer' | 'split';
};

export function CvTailoringSidebar({
  open,
  onClose,
  draft,
  onTailorMutation,
  jobTitle,
  jobCompany,
  exportTemplate,
  onTailoringCvPersisted,
  onSectionAccepted,
  scoreBeforeTailor,
  currentScore,
  tailoredCvName,
  jobAnalysisId,
  layout = 'split',
}: CvTailoringSidebarProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const exportCv = useExportCV();
  const tailorProfileQ = useCVProfileById(draft?.cvProfileId?.trim() ?? null);
  const [acceptingSectionId, setAcceptingSectionId] = useState<string | null>(null);
  const [rejectingSectionId, setRejectingSectionId] = useState<string | null>(null);
  const [acceptAllLoading, setAcceptAllLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'pdf' | 'docx' | null>(null);
  const [builderHydrateNonce, setBuilderHydrateNonce] = useState(0);
  const [builderHighlight, setBuilderHighlight] = useState<{
    sectionId: string;
    nonce: number;
    action: 'accepted' | 'reverted';
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isSplit = layout === 'split';
  const cvProfileId = draft?.cvProfileId?.trim() ?? '';
  const changesScrollRef = useRef<HTMLDivElement>(null);
  const resolvedTemplate = useMemo(
    () => (exportTemplate && isCvTemplateId(exportTemplate) ? exportTemplate : 'modern'),
    [exportTemplate],
  );

  const invalidateCv = async (cvProfileId: string) => {
    const id = cvProfileId.trim();
    if (!id) return;
    await rehydrateCvBuilderAfterStructuredPersist(queryClient, id);
    await queryClient.fetchQuery({
      queryKey: ['cv-profile', id],
      queryFn: () => api.cv.getProfileById(id),
    });
    setBuilderHydrateNonce((n) => n + 1);
  };

  const pendingDrafts = useMemo(
    () => draft?.drafts.filter((d) => d.status === 'pending') ?? [],
    [draft],
  );
  const acceptedDrafts = useMemo(
    () => draft?.drafts.filter((d) => d.status === 'accepted') ?? [],
    [draft],
  );
  const rejectedDrafts = useMemo(
    () => draft?.drafts.filter((d) => d.status === 'rejected') ?? [],
    [draft],
  );

  const reviewedCount = useMemo(() => {
    if (!draft) return 0;
    return draft.drafts.filter((d) => d.status === 'accepted' || d.status === 'rejected').length;
  }, [draft]);

  const totalCount = draft?.drafts.length ?? 0;
  const progress = totalCount > 0 ? reviewedCount / totalCount : 0;
  const hasPending = draft?.drafts.some((d) => d.status === 'pending') ?? false;
  const canExportCv = Boolean(draft?.cvProfileId?.trim()) && !hasPending;

  const handleExportCv = useCallback(
    async (format: 'pdf' | 'docx') => {
      if (!draft?.cvProfileId) return;
      setExportingFormat(format);
      try {
        await api.cv.updateTemplate(resolvedTemplate, draft.cvProfileId);
        const jobId = (jobAnalysisId ?? draft.jobAnalysisId ?? '').trim() || undefined;
        const tailorProfile = tailorProfileQ.data?.profile ?? null;
        await exportCv.mutateAsync({
          format,
          template: resolvedTemplate,
          cvProfileId: draft.cvProfileId,
          jobAnalysisId: jobId,
          profileForNaming: tailorProfile,
          profileDisplayName: tailorProfile
            ? inferCvProfileNameFromProfile(tailorProfile)
            : null,
          namingFallback: tailorProfile
            ? buildCvNamingForExport(tailorProfile, inferCvProfileNameFromProfile(tailorProfile), {
                tailored: true,
              })
            : undefined,
        });
        toast.success(`CV downloaded as ${format.toUpperCase()}`);
      } catch (e) {
        toast.error(getApiErrorMessage(e) || 'Could not download CV');
      } finally {
        setExportingFormat(null);
      }
    },
    [draft, exportCv, jobAnalysisId, resolvedTemplate, toast],
  );

  const handleAcceptAll = async () => {
    if (!draft) return;
    setAcceptAllLoading(true);
    try {
      const result = await api.cv.acceptAllTailorSections(draft.id);
      onTailorMutation(result);
      await invalidateCv(result.draft.cvProfileId);
      toast.success('All changes applied to your CV');
      onTailoringCvPersisted?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Could not accept all changes');
    } finally {
      setAcceptAllLoading(false);
    }
  };

  const wrapAccept = async (sectionId: string, fn: () => Promise<void>) => {
    setAcceptingSectionId(sectionId);
    try {
      await fn();
    } finally {
      setAcceptingSectionId(null);
    }
  };

  const wrapReject = async (sectionId: string, fn: () => Promise<void>) => {
    setRejectingSectionId(sectionId);
    try {
      await fn();
    } finally {
      setRejectingSectionId(null);
    }
  };

  const titleLine =
    jobTitle?.trim() || jobCompany?.trim()
      ? `For: ${jobTitle?.trim() || 'Role'} at ${jobCompany?.trim() || 'Company'}`
      : 'For: this job';

  const panel = (
    <>
      <div
        className={cn(
          'fixed inset-0 z-[100050] bg-black/70 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden={!open}
      />

      <div
        className={cn(
          'pointer-events-none fixed top-0 z-[100060] flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#090C0D] transition-all duration-300 ease-out',
          isSplit
            ? 'inset-x-0 w-full'
            : 'right-0 w-full max-w-[440px] border-l border-white/[0.08] shadow-[0_0_0_1px_rgba(0,201,177,0.06)]',
          open
            ? 'pointer-events-auto translate-x-0 opacity-100'
            : isSplit
              ? 'pointer-events-none opacity-0'
              : 'translate-x-full',
        )}
        aria-hidden={!open}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[#090C0D] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-white sm:text-lg">CV Tailoring</h2>
            {isSplit ? <p className="mt-0.5 truncate text-[12px] text-white/45">{titleLine}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] text-white/55 transition hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div
          className={cn(
            'flex min-h-0 flex-1 overflow-hidden',
            isSplit && 'grid min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_min(420px,38vw)]',
          )}
        >
          {isSplit && cvProfileId ? (
            <div className="hidden h-full min-h-0 overflow-hidden border-b border-white/[0.08] lg:block lg:border-b-0 lg:border-r">
              <TailorCvBuilderPane
                profileId={cvProfileId}
                rehydrateNonce={builderHydrateNonce}
                highlightSectionId={builderHighlight?.sectionId ?? null}
                highlightNonce={builderHighlight?.nonce ?? 0}
                highlightAction={builderHighlight?.action ?? 'accepted'}
                onAutosaved={() => onTailoringCvPersisted?.()}
                onStructuredPersisted={async () => {
                  await invalidateCv(cvProfileId);
                }}
              />
            </div>
          ) : null}
          <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:max-h-[calc(100dvh-3.5rem)]">
          <div
            ref={changesScrollRef}
            className="app-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-8 [-webkit-overflow-scrolling:touch] [scrollbar-gutter:stable] touch-pan-y sm:px-5 sm:py-5"
            onWheelCapture={(e) => {
              const el = changesScrollRef.current;
              if (!el || el.scrollHeight <= el.clientHeight) return;
              const atTop = el.scrollTop <= 0;
              const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
              const scrollingUp = e.deltaY < 0;
              const scrollingDown = e.deltaY > 0;
              if ((atTop && scrollingUp) || (atBottom && scrollingDown)) return;
              el.scrollTop += e.deltaY;
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            {!isSplit ? <p className="mb-4 text-[13px] leading-snug text-white/45">{titleLine}</p> : null}

            {scoreBeforeTailor != null &&
            Number.isFinite(scoreBeforeTailor) &&
            currentScore != null &&
            Number.isFinite(currentScore) &&
            (draft?.drafts.some((d) => d.status === 'accepted') || draft?.status === 'completed') ? (
              <div
                className={cn(
                  'mb-5 rounded-xl border border-white/[0.07] px-4 py-3',
                  Math.round(currentScore) > Math.round(scoreBeforeTailor)
                    ? 'bg-emerald-500/[0.06]'
                    : Math.round(currentScore) === Math.round(scoreBeforeTailor)
                      ? 'bg-white/[0.03]'
                      : 'bg-amber-500/[0.06]',
                )}
              >
                <p
                  className={cn(
                    'text-sm font-semibold',
                    Math.round(currentScore) > Math.round(scoreBeforeTailor)
                      ? 'text-emerald-300'
                      : Math.round(currentScore) === Math.round(scoreBeforeTailor)
                        ? 'text-white/55'
                        : 'text-amber-300',
                  )}
                >
                  Job fit after tailoring
                </p>
                <div className="mt-2 flex flex-wrap items-baseline gap-2 text-sm font-semibold text-white">
                  <span>{Math.round(scoreBeforeTailor)}%</span>
                  <span className="text-white/45">→</span>
                  <span
                    className={cn(
                      Math.round(currentScore) > Math.round(scoreBeforeTailor)
                        ? 'text-[#00C9B1]'
                        : Math.round(currentScore) === Math.round(scoreBeforeTailor)
                          ? 'text-white/60'
                          : 'text-amber-400',
                    )}
                  >
                    {Math.round(currentScore)}%
                  </span>
                  <span
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs font-semibold',
                      Math.round(currentScore) > Math.round(scoreBeforeTailor)
                        ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                        : Math.round(currentScore) === Math.round(scoreBeforeTailor)
                          ? 'border-white/15 bg-white/10 text-white/50'
                          : 'border-amber-400/35 bg-amber-500/15 text-amber-200',
                    )}
                  >
                    {(() => {
                      const d = Math.round(currentScore - scoreBeforeTailor);
                      if (d > 0) return `+${d}% job fit`;
                      if (d === 0) return 'No change';
                      return `${d}% job fit`;
                    })()}
                  </span>
                </div>
                {tailoredCvName?.trim() ? (
                  <p className="mt-2 text-xs leading-relaxed text-white/60">
                    Your tailored CV is saved as &quot;{tailoredCvName.trim()}&quot;
                  </p>
                ) : null}
              </div>
            ) : null}

            {draft && totalCount > 0 ? (
              <div className="mb-6 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-center">
                <p className="text-[13px] font-medium text-[#00C9B1]">
                  {reviewedCount} of {totalCount} changes reviewed
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-[#00C9B1] transition-[width] duration-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>
            ) : null}

            {draft && (pendingDrafts.length > 0 || acceptedDrafts.length > 0 || rejectedDrafts.length > 0) ? (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
                    Tailoring changes
                  </p>
                  <div className="flex flex-col items-end gap-1 text-[10px] text-white/50">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-400/90" aria-hidden />
                        Previous
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-400/90" aria-hidden />
                        Suggested
                      </span>
                    </div>
                    <span className="text-white/38">Accepted sections can be undone</span>
                  </div>
                </div>

                {pendingDrafts.length > 0 ? (
                  <TailorChangeGroup
                    title="Suggested changes"
                    count={pendingDrafts.length}
                    tone="pending"
                    entries={pendingDrafts}
                    draft={draft}
                    onTailorMutation={onTailorMutation}
                    invalidateCv={invalidateCv}
                    onTailoringCvPersisted={onTailoringCvPersisted}
                    onSectionAccepted={onSectionAccepted}
                    onBuilderHighlight={setBuilderHighlight}
                    acceptingSectionId={acceptingSectionId}
                    rejectingSectionId={rejectingSectionId}
                    wrapAccept={wrapAccept}
                    wrapReject={wrapReject}
                  />
                ) : null}

                {acceptedDrafts.length > 0 ? (
                  <TailorChangeGroup
                    title="Accepted"
                    count={acceptedDrafts.length}
                    tone="accepted"
                    entries={acceptedDrafts}
                    draft={draft}
                    onTailorMutation={onTailorMutation}
                    invalidateCv={invalidateCv}
                    onTailoringCvPersisted={onTailoringCvPersisted}
                    onSectionAccepted={onSectionAccepted}
                    onBuilderHighlight={setBuilderHighlight}
                    acceptingSectionId={acceptingSectionId}
                    rejectingSectionId={rejectingSectionId}
                    wrapAccept={wrapAccept}
                    wrapReject={wrapReject}
                  />
                ) : null}

                {rejectedDrafts.length > 0 ? (
                  <TailorChangeGroup
                    title="Rejected"
                    count={rejectedDrafts.length}
                    tone="rejected"
                    entries={rejectedDrafts}
                    draft={draft}
                    onTailorMutation={onTailorMutation}
                    invalidateCv={invalidateCv}
                    onTailoringCvPersisted={onTailoringCvPersisted}
                    onSectionAccepted={onSectionAccepted}
                    onBuilderHighlight={setBuilderHighlight}
                    acceptingSectionId={acceptingSectionId}
                    rejectingSectionId={rejectingSectionId}
                    wrapAccept={wrapAccept}
                    wrapReject={wrapReject}
                  />
                ) : null}
              </div>
            ) : draft ? (
              <p className="text-sm text-white/45">No section drafts in this response.</p>
            ) : (
              <p className="text-sm text-white/45">No draft loaded.</p>
            )}

            {draft && (hasPending || canExportCv) ? (
              <div className="mt-6 space-y-4 border-t border-white/[0.08] pt-5">
                {hasPending ? (
                  <Button
                    type="button"
                    fullWidth
                    className="gap-2"
                    disabled={acceptAllLoading || Boolean(exportingFormat)}
                    onClick={() => void handleAcceptAll()}
                  >
                    {acceptAllLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Accept all remaining
                  </Button>
                ) : null}

                {canExportCv ? (
                  <div className="space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
                      Download CV
                    </p>
                    <p className="text-[12px] leading-relaxed text-white/48">
                      Exports your saved CV ({resolvedTemplate}) including accepted tailoring changes.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        type="button"
                        variant="primary"
                        className="flex-1 gap-1.5"
                        disabled={Boolean(exportingFormat) || acceptAllLoading}
                        onClick={() => void handleExportCv('pdf')}
                      >
                        {exportingFormat === 'pdf' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4" />
                        )}
                        PDF
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="flex-1 gap-1.5 border border-white/10"
                        disabled={Boolean(exportingFormat) || acceptAllLoading}
                        onClick={() => void handleExportCv('docx')}
                      >
                        {exportingFormat === 'docx' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileDown className="h-4 w-4" />
                        )}
                        DOCX
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          </div>
        </div>
      </div>
    </>
  );

  if (!mounted) return null;
  return createPortal(panel, document.body);
}

function TailorChangeGroup({
  title,
  count,
  tone,
  entries,
  draft,
  onTailorMutation,
  invalidateCv,
  onTailoringCvPersisted,
  onSectionAccepted,
  onBuilderHighlight,
  acceptingSectionId,
  rejectingSectionId,
  wrapAccept,
  wrapReject,
}: {
  title: string;
  count: number;
  tone: 'pending' | 'accepted' | 'rejected';
  entries: CvTailorDraftEntry[];
  draft: CvTailorDraft;
  onTailorMutation: (result: TailorMutationResponse) => void;
  invalidateCv: (cvProfileId: string) => void;
  onTailoringCvPersisted?: () => void;
  onSectionAccepted?: (sectionType: string) => void;
  onBuilderHighlight: (v: { sectionId: string; nonce: number; action: 'accepted' | 'reverted' } | null) => void;
  acceptingSectionId: string | null;
  rejectingSectionId: string | null;
  wrapAccept: (sectionId: string, fn: () => Promise<void>) => Promise<void>;
  wrapReject: (sectionId: string, fn: () => Promise<void>) => Promise<void>;
}) {
  const toneStyles =
    tone === 'pending'
      ? 'border-amber-400/25 bg-amber-500/[0.04]'
      : tone === 'accepted'
        ? 'border-emerald-400/25 bg-emerald-500/[0.05]'
        : 'border-white/10 bg-white/[0.02]';

  return (
    <section className={cn('mb-5 rounded-2xl border p-3 sm:p-4', toneStyles)}>
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">{title}</h3>
        <span className="rounded-full border border-white/12 bg-black/30 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/55">
          {count}
        </span>
      </header>
      <div className={cn(tone === 'pending' ? 'space-y-0' : 'space-y-3')}>
        {entries.map((entry, index) =>
          tone === 'pending' ? (
            <div
              key={entry.sectionId}
              className="relative flex gap-4 pb-8 last:pb-2"
              data-tailor-pending-section={entry.sectionId}
            >
              <div className="flex w-10 shrink-0 flex-col items-center">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#00C9B1]/55 bg-[#00C9B1]/12 text-[13px] font-bold tabular-nums text-[#5EEAD4] shadow-[0_0_16px_rgba(0,201,177,0.2)]"
                  aria-hidden
                >
                  {index + 1}
                </span>
                {index < entries.length - 1 ? (
                  <span
                    className="mt-2 w-px flex-1 min-h-[2rem] bg-gradient-to-b from-[#00C9B1]/45 via-[#00C9B1]/15 to-transparent"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <SectionDiffCardWrapper
                  entry={entry}
                  draft={draft}
                  draftId={draft.id}
                  jobAnalysisId={draft.jobAnalysisId}
                  onTailorMutation={onTailorMutation}
                  onInvalidate={invalidateCv}
                  onTailoringCvPersisted={onTailoringCvPersisted}
                  onSectionAccepted={onSectionAccepted}
                  onBuilderHighlight={onBuilderHighlight}
                  accepting={acceptingSectionId === entry.sectionId}
                  rejecting={rejectingSectionId === entry.sectionId}
                  wrapAccept={wrapAccept}
                  wrapReject={wrapReject}
                  compactTone={tone}
                  stepLabel={`Change ${index + 1}`}
                />
              </div>
            </div>
          ) : (
            <SectionDiffCardWrapper
              key={entry.sectionId}
              entry={entry}
              draft={draft}
              draftId={draft.id}
              jobAnalysisId={draft.jobAnalysisId}
              onTailorMutation={onTailorMutation}
              onInvalidate={invalidateCv}
              onTailoringCvPersisted={onTailoringCvPersisted}
              onSectionAccepted={onSectionAccepted}
              onBuilderHighlight={onBuilderHighlight}
              accepting={acceptingSectionId === entry.sectionId}
              rejecting={rejectingSectionId === entry.sectionId}
              wrapAccept={wrapAccept}
              wrapReject={wrapReject}
              compactTone={tone}
            />
          ),
        )}
      </div>
    </section>
  );
}

function SectionDiffCardWrapper({
  entry,
  draft,
  draftId,
  jobAnalysisId,
  onTailorMutation,
  onInvalidate,
  onTailoringCvPersisted,
  onSectionAccepted,
  onBuilderHighlight,
  accepting,
  rejecting,
  wrapAccept,
  wrapReject,
  compactTone,
  stepLabel,
}: {
  entry: CvTailorDraftEntry;
  draft: CvTailorDraft;
  draftId: string;
  jobAnalysisId?: string;
  onTailorMutation: (result: TailorMutationResponse) => void;
  onInvalidate: (cvProfileId: string) => void | Promise<void>;
  onTailoringCvPersisted?: () => void;
  onSectionAccepted?: (sectionType: string) => void;
  onBuilderHighlight?: (v: { sectionId: string; nonce: number; action: 'accepted' | 'reverted' } | null) => void;
  accepting: boolean;
  rejecting: boolean;
  wrapAccept: (sectionId: string, fn: () => Promise<void>) => Promise<void>;
  wrapReject: (sectionId: string, fn: () => Promise<void>) => Promise<void>;
  compactTone?: 'pending' | 'accepted' | 'rejected';
  stepLabel?: string;
}) {
  const toast = useToast();
  const [undoing, setUndoing] = useState(false);

  const liveEntry = draft.drafts.find((d) => d.sectionId === entry.sectionId) ?? entry;

  const statusBadge =
    liveEntry.status === 'pending' ? (
      <Badge variant="amber">Pending</Badge>
    ) : liveEntry.status === 'accepted' ? (
      <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-300" variant="teal">
        Accepted
      </Badge>
    ) : (
      <Badge variant="muted">Rejected</Badge>
    );

  const runAccept = async () => {
    try {
      const result = await api.cv.acceptTailorSection(draftId, liveEntry.sectionId);
      onTailorMutation(result);
      await onInvalidate(result.draft.cvProfileId);
      const builderId = tailorSectionTypeToBuilderId(liveEntry.sectionType);
      onBuilderHighlight?.({ sectionId: builderId, nonce: Date.now(), action: 'accepted' });
      onSectionAccepted?.(liveEntry.sectionType);
      toast.success('Change accepted — CV updated');
      onTailoringCvPersisted?.();
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Could not accept change');
      throw e;
    }
  };

  const runReject = async () => {
    try {
      const result = await api.cv.rejectTailorSection(draftId, liveEntry.sectionId);
      onTailorMutation(result);
      onInvalidate(result.draft.cvProfileId);
      toast.success('Change rejected');
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Could not reject change');
      throw e;
    }
  };

  const runUndo = async () => {
    const patchId = liveEntry.patchId?.trim();
    if (!patchId) {
      toast.error('Undo is not available for this section');
      return;
    }
    setUndoing(true);
    try {
      const result = await api.cv.revertPatch(patchId);
      onTailorMutation(result);
      await onInvalidate(result.draft.cvProfileId);
      const builderId = tailorSectionTypeToBuilderId(liveEntry.sectionType);
      onBuilderHighlight?.({ sectionId: builderId, nonce: Date.now(), action: 'reverted' });
      toast.success('Change reverted — you can accept again');
    } catch (e) {
      toast.error(getApiErrorMessage(e) || 'Could not undo change');
    } finally {
      setUndoing(false);
    }
  };

  const cardToneClass =
    compactTone === 'accepted'
      ? 'border-emerald-400/20 bg-emerald-950/20'
      : compactTone === 'rejected'
        ? 'border-white/[0.06] bg-black/20 opacity-90'
        : 'border-white/[0.08] bg-white/[0.025]';

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-sm shadow-black/20 transition-shadow',
        cardToneClass,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          {stepLabel ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#00C9B1]/80">{stepLabel}</p>
          ) : null}
          <h4 className="text-[15px] font-semibold tracking-tight text-white">{sectionTitle(liveEntry.sectionType)}</h4>
        </div>
        {statusBadge}
      </div>

      <TailorChangeHighlights
        sectionType={liveEntry.sectionType}
        beforeRaw={liveEntry.before}
        afterRaw={liveEntry.after}
        changedFields={liveEntry.changedFields}
        className="mb-3"
      />

      {liveEntry.status === 'pending' ? (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            variant="primary"
            className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
            disabled={accepting || rejecting}
            onClick={() => void wrapAccept(liveEntry.sectionId, runAccept)}
          >
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Accept
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 gap-1.5 border-rose-400/30 text-rose-300 hover:border-rose-400/50 hover:bg-rose-500/10"
            disabled={accepting || rejecting}
            onClick={() => void wrapReject(liveEntry.sectionId, runReject)}
          >
            {rejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            Reject
          </Button>
        </div>
      ) : liveEntry.status === 'accepted' ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-emerald-300/80">Accepted in your CV</p>
          {liveEntry.patchId?.trim() ? (
            <Button
              type="button"
              variant="ghost"
              className="h-8 gap-1.5 border border-amber-400/35 px-2.5 text-[11px] text-amber-100"
              disabled={undoing || accepting || rejecting}
              onClick={() => void runUndo()}
            >
              {undoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Undo
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-white/40">Rejected</p>
      )}
    </div>
  );
}
