'use client';

import { FileDown, FileText, Loader2, MoreVertical, Plus, Star, Upload } from 'lucide-react';
import Link from 'next/link';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
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
import { useDeleteCVProfile } from '@/hooks/useDeleteCVProfile';
import { useDuplicateCVProfile } from '@/hooks/useDuplicateCVProfile';
import { useRenameCVProfile } from '@/hooks/useRenameCVProfile';
import { useSetDefaultCVProfile } from '@/hooks/useSetDefaultCVProfile';
import { openCvPdfInNewTab } from '@/lib/cv-open-pdf-tab';
import { getApiErrorMessage } from '@/lib/axios';
import type { CvProfileSummary } from '@/lib/api';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { cn } from '@/lib/utils';

function scoreBarColor(score: number | null): string {
  if (score === null || Number.isNaN(score)) return 'bg-white/15';
  if (score >= 70) return 'bg-[#22C55E]';
  if (score >= 50) return 'bg-[#F59E0B]';
  return 'bg-[#EF4444]';
}

type DashboardCvProfilesPanelProps = {
  profiles: CvProfileSummary[];
  isLoading: boolean;
  onNewCv: () => void;
};

export function DashboardCvProfilesPanel({ profiles, isLoading, onNewCv }: DashboardCvProfilesPanelProps) {
  const toast = useToast();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const duplicate = useDuplicateCVProfile();
  const del = useDeleteCVProfile();
  const setDefault = useSetDefaultCVProfile();
  const rename = useRenameCVProfile();

  const [deleteTarget, setDeleteTarget] = useState<CvProfileSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<CvProfileSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [pdfOpeningId, setPdfOpeningId] = useState<string | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const mergeSelection = useCvProfileMergeSelection(profiles);

  useEffect(() => {
    if (!menuId) return;
    const onDoc = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
        setMenuAnchor(null);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuId]);

  useLayoutEffect(() => {
    if (!menuId || !menuAnchor) return;
    const onReposition = () => {
      setMenuAnchor(null);
      setMenuId(null);
    };
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [menuId, menuAnchor]);

  const openRename = useCallback((p: CvProfileSummary) => {
    setMenuId(null);
    setMenuAnchor(null);
    setRenameTarget(p);
    setRenameValue(p.name);
  }, []);

  const openMenu = useCallback((e: ReactMouseEvent, profileId: string) => {
    const el = e.currentTarget as HTMLElement;
    if (menuId === profileId) {
      setMenuId(null);
      setMenuAnchor(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setMenuAnchor({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
    setMenuId(profileId);
  }, [menuId]);

  const menuProfile = menuId ? profiles.find((x) => x.id === menuId) : undefined;

  return (
    <GlowCard className="border border-[rgba(0,201,177,0.15)]" contentClassName="p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-white">CV Profiles</h2>
        <Button
          type="button"
          className="h-9 gap-1.5 px-3 text-xs font-semibold"
          onClick={onNewCv}
        >
          <Plus className="h-3.5 w-3.5" />
          New CV
        </Button>
      </div>
      {!isLoading && profiles.length > 0 ? (
        <p className="mb-3 shrink-0 text-[11px] leading-relaxed text-white/35">
          CV scores come from AI analysis of your CV. New or edited profiles can take a short moment to show a score —
          we refresh this list when you come back to the tab and after you run a CV scan.
        </p>
      ) : null}

      {!isLoading && profiles.length > 1 ? (
        <p className="mb-2 text-[11px] text-white/35">
          Select two or more CVs to merge into a new profile. Originals are not changed.
        </p>
      ) : null}

      <CvProfileMergeToolbar
        selectedCount={mergeSelection.selectedList.length}
        canMerge={mergeSelection.canMerge}
        overLimit={mergeSelection.overLimit}
        onClear={mergeSelection.clear}
        onMerge={() => setMergeOpen(true)}
        className="mb-3"
      />

      <div className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton height={80} borderRadius={12} />
            <Skeleton height={80} borderRadius={12} />
          </>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <FileText className="h-8 w-8 text-[#00C9B1]" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-semibold text-white">No CV profiles yet</p>
            <p className="mt-1 max-w-xs text-xs text-white/45">Create your first CV to get started</p>
            <Button type="button" className="mt-5" onClick={onNewCv}>
              Create CV
            </Button>
          </div>
        ) : (
          profiles.map((p) => {
            const score = p.score;
            const pct = score !== null && Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : 0;
            return (
              <GlowCard
                key={p.id}
                className="h-auto shrink-0 border border-[rgba(0,201,177,0.1)] bg-[#111616]"
                contentClassName="relative p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
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
                    <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {p.isDefault ? <Star className="h-3.5 w-3.5 shrink-0 fill-[#00C9B1] text-[#00C9B1]" /> : null}
                      <p className="truncate text-[15px] font-semibold text-white">{p.name}</p>
                      {p.isDefault ? (
                        <span className="shrink-0 rounded-full border border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.12)] px-2 py-0.5 text-[11px] font-semibold text-[#00C9B1]">
                          ★ Default
                        </span>
                      ) : null}
                      {p.originalTemplate ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-white/30">
                          <Upload className="h-2.5 w-2.5 shrink-0 text-white/35" aria-hidden />
                          Uploaded
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-white/45">
                      {score !== null && Number.isFinite(score) ? `Score: ${score}/100` : 'Not scored yet'}
                      {' · '}
                      Last edited {formatRelativeEdited(p.updatedAt)}
                    </p>
                    </div>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      aria-label="More actions"
                      className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/5 hover:text-white"
                      onClick={(ev) => openMenu(ev, p.id)}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={cn('h-full rounded-full transition-all', scoreBarColor(score))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="shrink-0 tabular-nums text-white/55">
                      {score !== null && Number.isFinite(score) ? `${score}/100` : '—'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/cv?profileId=${encodeURIComponent(p.id)}`}
                    className="inline-flex items-center rounded-lg border border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.08)] px-3 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:bg-[rgba(0,201,177,0.15)]"
                  >
                    Edit →
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 hover:border-[#00C9B1]/35 hover:text-[#00C9B1]"
                    disabled={pdfOpeningId === p.id}
                    onClick={() => {
                      setPdfOpeningId(p.id);
                      void openCvPdfInNewTab(p.id, p.template ?? undefined)
                        .catch((e: unknown) => toast.error(getApiErrorMessage(e)))
                        .finally(() => setPdfOpeningId(null));
                    }}
                  >
                    {pdfOpeningId === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <FileDown className="mr-1 inline h-3.5 w-3.5" />
                        View PDF
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto border border-white/10 px-3 py-1.5 text-xs"
                    disabled={duplicate.isPending && duplicate.variables === p.id}
                    onClick={() =>
                      duplicate.mutate(p.id, {
                        onSuccess: () => toast.success('CV duplicated'),
                        onError: (e) => toast.error(getApiErrorMessage(e)),
                      })
                    }
                  >
                    {duplicate.isPending && duplicate.variables === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Duplicate'
                    )}
                  </Button>
                </div>
              </GlowCard>
            );
          })
        )}
      </div>

      {!isLoading && profiles.length > 0 ? (
        <Button type="button" variant="ghost" fullWidth className="mt-4 border border-[rgba(0,201,177,0.2)]" onClick={onNewCv}>
          <Plus className="mr-1 h-4 w-4" />
          Create new CV profile
        </Button>
      ) : null}

      {typeof document !== 'undefined' && menuProfile && menuAnchor
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[200] min-w-[10rem] rounded-xl border border-[rgba(0,201,177,0.15)] bg-[#161B1B] py-1 shadow-lg"
              style={{ top: menuAnchor.top, right: menuAnchor.right }}
            >
              {!menuProfile.isDefault ? (
                <button
                  type="button"
                  disabled={setDefault.isPending && setDefault.variables === menuProfile.id}
                  className="block w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5 disabled:opacity-50"
                  onClick={() => {
                    setDefault.mutate(menuProfile.id, {
                      onSuccess: () => {
                        toast.success('Default CV updated');
                        setMenuId(null);
                        setMenuAnchor(null);
                      },
                      onError: (e) => toast.error(getApiErrorMessage(e)),
                    });
                  }}
                >
                  Set as default
                </button>
              ) : null}
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs text-white/80 hover:bg-white/5"
                onClick={() => openRename(menuProfile)}
              >
                Rename
              </button>
              <button
                type="button"
                disabled={profiles.length <= 1 || del.isPending}
                className="block w-full px-3 py-2 text-left text-xs text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  if (profiles.length <= 1) {
                    toast.error('You need at least one CV profile.');
                    return;
                  }
                  setMenuId(null);
                  setMenuAnchor(null);
                  setDeleteTarget(menuProfile);
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
        title="Delete CV profile?"
        description={deleteTarget ? `Permanently remove “${deleteTarget.name}”? This cannot be undone.` : undefined}
        confirmLabel="Delete"
        variant="danger"
        isPending={del.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await del.mutateAsync(deleteTarget.id);
            toast.success('CV profile deleted');
          } catch (e) {
            toast.error(getApiErrorMessage(e));
            throw e;
          }
        }}
      />

      <Modal open={Boolean(renameTarget)} onOpenChange={(o) => !o && setRenameTarget(null)} title="Rename CV profile">
        <input
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          className="mt-2 w-full rounded-xl border border-[rgba(0,201,177,0.15)] bg-[#111616] px-3 py-2 text-sm text-white outline-none focus:border-[#00C9B1]"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={rename.isPending || !renameTarget || !renameValue.trim()}
            onClick={() => {
              if (!renameTarget) return;
              rename.mutate(
                { id: renameTarget.id, name: renameValue.trim() || renameTarget.name },
                {
                  onSuccess: () => {
                    toast.success('Profile renamed');
                    setRenameTarget(null);
                  },
                  onError: (e) => toast.error(getApiErrorMessage(e)),
                },
              );
            }}
          >
            {rename.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </Modal>

      <MergeCvProfilesModal
        open={mergeOpen}
        onOpenChange={(open) => {
          setMergeOpen(open);
          if (!open) mergeSelection.clear();
        }}
        profileIds={mergeSelection.selectedList}
        profiles={profiles}
      />
    </GlowCard>
  );
}
