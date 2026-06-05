'use client';

import {
  Briefcase,
  FileText,
  History,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Plus,
  ScrollText,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ScrollContentEnd } from '@/components/ui/ScrollContentEnd';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GlowCard } from '@/components/ui/GlowCard';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import {
  CvProfileMergeCheckbox,
  CvProfileMergeToolbar,
  MergeCvProfilesModal,
  useCvProfileMergeSelection,
} from '@/components/dashboard/MergeCvProfilesModal';
import { useClientPagination } from '@/hooks/useClientPagination';
import { useDeleteCVProfile } from '@/hooks/useDeleteCVProfile';
import { useRenameCVProfile } from '@/hooks/useRenameCVProfile';
import { useJobHistory } from '@/hooks/useJobHistory';
import { ensureArray } from '@/lib/ensure-array';
import type { CvProfileSummary, JobHistoryItem } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { cn } from '@/lib/utils';

const ACTION_TILE =
  'group relative flex w-full items-center gap-3.5 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0C0F0F] p-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#00C9B1]/30 hover:bg-[#0f1414] sm:p-4';

const SECTION_SHELL =
  'overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0C0F0F] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';

type ViewMode = 'cards' | 'table';

function HubViewToggle({
  value,
  onChange,
  idPrefix,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  idPrefix: string;
}) {
  return (
    <div className="inline-flex rounded-xl border border-white/[0.08] bg-black/30 p-0.5" role="group" aria-label="View mode">
      <button
        type="button"
        id={`${idPrefix}-cards`}
        aria-pressed={value === 'cards'}
        onClick={() => onChange('cards')}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg transition',
          value === 'cards' ? 'bg-[#00C9B1]/20 text-[#00C9B1]' : 'text-white/45 hover:text-white/75',
        )}
        title="Card view"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        id={`${idPrefix}-table`}
        aria-pressed={value === 'table'}
        onClick={() => onChange('table')}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-lg transition',
          value === 'table' ? 'bg-[#00C9B1]/20 text-[#00C9B1]' : 'text-white/45 hover:text-white/75',
        )}
        title="Table view"
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}

function HubActionTile({
  icon,
  iconWrapClassName,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  iconWrapClassName: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-label={title} onClick={onClick} className={ACTION_TILE}>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition group-hover:opacity-95 sm:h-11 sm:w-11',
          iconWrapClassName,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white sm:text-[15px]">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-white/45">{description}</p>
      </div>
    </button>
  );
}

function HubActionLink({
  href,
  icon,
  iconWrapClassName,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  iconWrapClassName: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className={cn(ACTION_TILE, 'no-underline')}>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition group-hover:opacity-95 sm:h-11 sm:w-11',
          iconWrapClassName,
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white sm:text-[15px]">{title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-white/45">{description}</p>
      </div>
    </Link>
  );
}

type CvClinicHubProps = {
  profiles: CvProfileSummary[];
  loading?: boolean;
  onNewCv: () => void;
  onOpenCv: (profileId: string) => void;
};

const HUB_PAGE_SIZE = 10;

function norm(s: string) {
  return s.trim().toLowerCase();
}

function jobCoverLetterHref(jobAnalysisId: string) {
  return `/dashboard/jobs?jobId=${encodeURIComponent(jobAnalysisId)}&tab=cover`;
}

function HubPagination({
  page,
  setPage,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  showPager,
}: {
  page: number;
  setPage: (n: number | ((p: number) => number)) => void;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  total: number;
  showPager: boolean;
}) {
  if (!showPager) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
      <p className="text-xs text-white/40">
        Showing {rangeStart}–{rangeEnd} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs tabular-nums text-white/45">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="rounded-lg border border-white/[0.1] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function HubProfileActions({
  profile,
  profiles,
  onOpenCv,
}: {
  profile: CvProfileSummary;
  profiles: CvProfileSummary[];
  onOpenCv: (profileId: string) => void;
}) {
  const toast = useToast();
  const del = useDeleteCVProfile();
  const rename = useRenameCVProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CvProfileSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<CvProfileSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setMenuAnchor(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useLayoutEffect(() => {
    if (!menuOpen || !menuAnchor) return;
    const close = () => {
      setMenuOpen(false);
      setMenuAnchor(null);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menuOpen, menuAnchor]);

  const openMenu = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    setMenuAnchor({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  }, []);

  return (
    <>
      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => onOpenCv(profile.id)}
          className="inline-flex items-center gap-1 rounded-lg border border-[#00C9B1]/35 bg-[#00C9B1]/10 px-2.5 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:bg-[#00C9B1]/20"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </button>
        <button
          type="button"
          aria-label="More actions"
          className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/5 hover:text-white"
          onClick={openMenu}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
      {typeof document !== 'undefined' && menuOpen && menuAnchor
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[200] min-w-[10rem] rounded-xl border border-[rgba(0,201,177,0.15)] bg-[#161B1B] py-1 shadow-lg"
              style={{ top: menuAnchor.top, right: menuAnchor.right }}
            >
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5"
                onClick={() => {
                  setMenuOpen(false);
                  setMenuAnchor(null);
                  setRenameTarget(profile);
                  setRenameValue(profile.name);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                disabled={profiles.length <= 1 || del.isPending}
                className="block w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  if (profiles.length <= 1) {
                    toast.error('You need at least one resume profile.');
                    return;
                  }
                  setMenuOpen(false);
                  setMenuAnchor(null);
                  setDeleteTarget(profile);
                }}
              >
                Delete
              </button>
            </div>,
            document.body,
          )
        : null}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title="Delete resume?"
        description={
          deleteTarget ? `Permanently remove “${deleteTarget.name}”? This cannot be undone.` : undefined
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await del.mutateAsync(deleteTarget.id);
            toast.success('Resume deleted');
            setDeleteTarget(null);
          } catch (e) {
            toast.error(getApiErrorMessage(e));
          }
        }}
      />
      <Modal
        open={Boolean(renameTarget)}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        title="Rename resume"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!renameTarget) return;
            const name = renameValue.trim();
            if (!name) return;
            void rename.mutateAsync(
              { id: renameTarget.id, name },
              {
                onSuccess: () => {
                  toast.success('Resume renamed');
                  setRenameTarget(null);
                },
                onError: (err) => toast.error(getApiErrorMessage(err)),
              },
            );
          }}
        >
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-[#0C0F0F] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00C9B1]/50"
            autoFocus
          />
          <button
            type="submit"
            disabled={!renameValue.trim() || rename.isPending}
            className="w-full rounded-xl bg-[#00C9B1] py-2.5 text-sm font-semibold text-[#080A0A] disabled:opacity-50"
          >
            Save
          </button>
        </form>
      </Modal>
    </>
  );
}

export function CvClinicHub({
  profiles,
  loading = false,
  onNewCv,
  onOpenCv,
}: CvClinicHubProps) {
  const history = useJobHistory();
  const jobItems = ensureArray<JobHistoryItem>(history.data);

  const [cvSearch, setCvSearch] = useState('');
  const [clSearch, setClSearch] = useState('');
  const [cvView, setCvView] = useState<ViewMode>('cards');
  const [clView, setClView] = useState<ViewMode>('cards');
  const [mergeOpen, setMergeOpen] = useState(false);
  const mergeSelection = useCvProfileMergeSelection(profiles);

  const coverLetterRows = useMemo(
    () =>
      jobItems
        .filter((j) => j.hasCoverLetter)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [jobItems],
  );

  const filteredProfiles = useMemo(() => {
    const q = norm(cvSearch);
    if (!q) return profiles;
    return profiles.filter((p) => {
      const hay = [p.name, p.headline ?? '', p.location ?? '', p.template ?? ''].map(norm).join(' ');
      return hay.includes(q);
    });
  }, [profiles, cvSearch]);

  const filteredLetters = useMemo(() => {
    const q = norm(clSearch);
    if (!q) return coverLetterRows;
    return coverLetterRows.filter((j) => {
      const hay = norm(`${j.company} ${j.jobTitle} ${j.title ?? ''}`);
      return hay.includes(q);
    });
  }, [coverLetterRows, clSearch]);

  const cvPagination = useClientPagination(filteredProfiles, HUB_PAGE_SIZE);
  const clPagination = useClientPagination(filteredLetters, HUB_PAGE_SIZE);
  const pagedProfiles = cvPagination.pageItems;
  const pagedLetters = clPagination.pageItems;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-6 pt-2 sm:gap-10 sm:pb-8">
      <header className="space-y-2 px-4 sm:px-0" data-tour="cv-clinic-intro">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00C9B1]">Resume workspace</p>
        <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-3xl">What would you like to do?</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-white/50">
          Start a resume, upload an existing one, or jump to jobs and analyses. Open anything below to keep editing —
          your work saves automatically.
        </p>
      </header>

      <section aria-label="Quick actions" className="grid gap-3 px-4 sm:grid-cols-2 sm:gap-4 sm:px-0" data-tour="cv-clinic-actions">
        <HubActionTile
          icon={<Plus className="h-5 w-5" strokeWidth={2.25} />}
          iconWrapClassName="bg-[#00C9B1]/15 text-[#00C9B1] ring-[#00C9B1]/25 group-hover:bg-[#00C9B1]/20"
          title="New resume"
          description="Pick a template, then build with AI or start blank"
          onClick={onNewCv}
        />
        <HubActionLink
          href="/dashboard/analyses"
          icon={<History className="h-5 w-5" />}
          iconWrapClassName="bg-emerald-500/10 text-emerald-300 ring-emerald-400/20 group-hover:bg-emerald-500/15"
          title="Analysis history"
          description="Match scores, notes, and cover letters from analyzed jobs"
        />
      </section>

      <div
        className={cn(SECTION_SHELL, 'mx-4 flex flex-col gap-3 p-4 sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:p-5')}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#00C9B1]/90">Tip</p>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Open any resume below to edit, score, and export. Cover letters open on the letter tab in Jobs.
          </p>
        </div>
        <Link
          href="/dashboard/jobs"
          className="inline-flex w-fit shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-[#00C9B1]/30 bg-[#00C9B1]/10 px-3.5 py-2 text-xs font-semibold text-[#00C9B1] transition hover:bg-[#00C9B1]/15 sm:self-center sm:text-sm"
        >
          <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          Jobs workspace
        </Link>
      </div>

      <section aria-labelledby="cv-library-heading" className={cn(SECTION_SHELL, 'space-y-4 p-4 sm:p-5')} data-tour="cv-clinic-library">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="cv-library-heading" className="text-lg font-bold text-white sm:text-xl">
              Recent resumes
            </h2>
            <p className="mt-0.5 text-sm text-white/45">Open a resume to enter the Resume Clinic editor</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="search"
                value={cvSearch}
                onChange={(e) => setCvSearch(e.target.value)}
                placeholder="Search CVs…"
                className="h-10 w-full rounded-xl border border-white/[0.1] bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#00C9B1]/45 focus:ring-2 focus:ring-[#00C9B1]/15"
                aria-label="Search CVs"
              />
            </div>
            <HubViewToggle value={cvView} onChange={setCvView} idPrefix="cv" />
          </div>
        </div>

        {profiles.length > 1 ? (
          <CvProfileMergeToolbar
            selectedCount={mergeSelection.selectedList.length}
            canMerge={mergeSelection.canMerge}
            overLimit={mergeSelection.overLimit}
            onClear={mergeSelection.clear}
            onMerge={() => setMergeOpen(true)}
          />
        ) : null}

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={140} borderRadius={16} />
            ))}
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.1] bg-black/20 px-6 py-10 text-center">
            <FileText className="mx-auto h-9 w-9 text-white/20" />
            <p className="mt-3 text-sm font-medium text-white/70">No resumes match your search</p>
            <p className="mt-1 text-xs text-white/40">Try another term or clear the search box</p>
          </div>
        ) : cvView === 'cards' ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pagedProfiles.map((p) => (
              <li key={p.id}>
                <div className="group flex h-full w-full flex-col rounded-xl border border-white/[0.08] bg-black/20 p-4 text-left transition hover:border-[#00C9B1]/30 hover:bg-white/[0.02]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      {profiles.length > 1 ? (
                        <CvProfileMergeCheckbox
                          checked={mergeSelection.selectedIds.has(p.id)}
                          disabled={
                            !mergeSelection.selectedIds.has(p.id) &&
                            mergeSelection.selectedList.length >= 6
                          }
                          onChange={() => mergeSelection.toggle(p.id)}
                          label={`Select ${p.name} for merge`}
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onOpenCv(p.id)}
                        className="min-w-0 flex-1 text-left font-semibold text-white group-hover:text-[#00C9B1]"
                      >
                        {p.name}
                      </button>
                    </div>
                    {p.isDefault ? (
                      <span className="shrink-0 rounded-full bg-[#00C9B1]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#00C9B1]">
                        Default
                      </span>
                    ) : null}
                  </div>
                  {(p.headline ?? '').trim() ? (
                    <p className="mt-2 line-clamp-2 text-xs text-white/50">{p.headline}</p>
                  ) : (
                    <p className="mt-2 text-xs italic text-white/30">No headline yet</p>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-3 text-[11px] text-white/40">
                    {p.template ? <span className="capitalize text-white/55">{p.template}</span> : null}
                    {p.score != null ? (
                      <span className="font-semibold tabular-nums text-[#00C9B1]">{p.score}/100</span>
                    ) : null}
                    <span className="text-white/35">· {formatRelativeEdited(p.updatedAt)}</span>
                  </div>
                  <div className="mt-4 flex justify-end border-t border-white/[0.06] pt-3">
                    <HubProfileActions profile={p} profiles={profiles} onOpenCv={onOpenCv} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <GlowCard className="overflow-hidden border border-white/[0.08]" contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    {profiles.length > 1 ? <th className="w-10 px-2 py-3" /> : null}
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Headline</th>
                    <th className="px-4 py-3">Template</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedProfiles.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.05] transition hover:bg-white/[0.03]">
                      {profiles.length > 1 ? (
                        <td className="px-2 py-3">
                          <CvProfileMergeCheckbox
                            checked={mergeSelection.selectedIds.has(p.id)}
                            disabled={
                              !mergeSelection.selectedIds.has(p.id) &&
                              mergeSelection.selectedList.length >= 6
                            }
                            onChange={() => mergeSelection.toggle(p.id)}
                            label={`Select ${p.name} for merge`}
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-3 font-medium text-white">
                        <button
                          type="button"
                          className="text-left hover:text-[#00C9B1]"
                          onClick={() => onOpenCv(p.id)}
                        >
                          {p.name}
                        </button>
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-white/50">{p.headline?.trim() || '—'}</td>
                      <td className="px-4 py-3 capitalize text-white/55">{p.template ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-[#00C9B1]">{p.score != null ? `${p.score}/100` : '—'}</td>
                      <td className="px-4 py-3 text-white/40">
                        {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <HubProfileActions profile={p} profiles={profiles} onOpenCv={onOpenCv} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlowCard>
        )}
        <HubPagination {...cvPagination} />
      </section>

      <section aria-labelledby="cl-heading" className={cn(SECTION_SHELL, 'space-y-4 p-4 sm:p-5')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="cl-heading" className="text-lg font-bold text-white sm:text-xl">
              Cover letters
            </h2>
            <p className="mt-0.5 text-sm text-white/45">Opens directly on the cover letter tab in Jobs</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="search"
                value={clSearch}
                onChange={(e) => setClSearch(e.target.value)}
                placeholder="Search cover letters…"
                className="h-10 w-full rounded-xl border border-white/[0.1] bg-black/40 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#00C9B1]/45 focus:ring-2 focus:ring-[#00C9B1]/15"
                aria-label="Search cover letters"
              />
            </div>
            <HubViewToggle value={clView} onChange={setClView} idPrefix="cl" />
          </div>
        </div>

        {history.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={72} borderRadius={12} />
            ))}
          </div>
        ) : filteredLetters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/[0.1] bg-black/20 px-6 py-10 text-center">
            <ScrollText className="mx-auto h-9 w-9 text-white/20" />
            <p className="mt-3 text-sm font-medium text-white/70">
              {coverLetterRows.length === 0 ? 'No saved cover letters yet' : 'No matches for your search'}
            </p>
            <p className="mt-1 text-xs text-white/40">
              {coverLetterRows.length === 0
                ? 'Run a job analysis and generate a letter. It will show up here.'
                : 'Try another company or role keyword.'}
            </p>
            <Link
              href="/dashboard/jobs"
              className="mt-5 inline-flex w-auto items-center justify-center gap-2 rounded-lg bg-[#00C9B1] px-4 py-2 text-sm font-semibold text-[#080A0A] transition hover:bg-[#00C9B1]/90"
            >
              <Briefcase className="h-4 w-4" />
              Go to Jobs
            </Link>
            <p className="mt-4 text-[11px] text-white/30">
              Or browse{' '}
              <Link href="/dashboard/analyses" className="text-[#00C9B1] hover:underline">
                all job analyses
              </Link>
              .
            </p>
          </div>
        ) : clView === 'cards' ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pagedLetters.map((j) => (
              <li key={j.id}>
                <Link
                  href={jobCoverLetterHref(j.id)}
                  className="group flex h-full flex-col rounded-xl border border-white/[0.08] bg-black/20 p-4 transition hover:border-[#00C9B1]/30 hover:bg-white/[0.02]"
                >
                  <p className="font-semibold text-white group-hover:text-[#00C9B1]">{j.company || 'Company'}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-white/55">{j.jobTitle || j.title || 'Role'}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[11px] text-white/40">
                    <span className="inline-flex items-center gap-1 text-[#00C9B1]/90">
                      <ScrollText className="h-3.5 w-3.5" />
                      Cover letter
                    </span>
                    <span>{j.createdAt ? new Date(j.createdAt).toLocaleDateString() : ''}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <GlowCard className="overflow-hidden border border-white/[0.08]" contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Match</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {pagedLetters.map((j) => (
                    <tr key={j.id} className="border-b border-white/[0.05] transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{j.company || '—'}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-white/55">{j.jobTitle || j.title || '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-white/60">{j.matchScore ?? '—'}%</td>
                      <td className="px-4 py-3 text-white/40">
                        {j.createdAt ? new Date(j.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={jobCoverLetterHref(j.id)}
                          className="inline-block rounded-lg border border-[#00C9B1]/35 bg-[#00C9B1]/10 px-3 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:bg-[#00C9B1]/20"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlowCard>
        )}
        <HubPagination {...clPagination} />
      </section>

      <MergeCvProfilesModal
        open={mergeOpen}
        onOpenChange={(open) => {
          setMergeOpen(open);
          if (!open) mergeSelection.clear();
        }}
        profileIds={mergeSelection.selectedList}
        profiles={profiles}
        onMerged={onOpenCv}
      />
      <ScrollContentEnd className="max-lg:h-2" />
    </div>
  );
}
