'use client';

import { FileDown, FileText, Loader2, MoreVertical, Star } from 'lucide-react';
import Link from 'next/link';
import type { MouseEvent as ReactMouseEvent } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
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
import { getApiErrorMessage } from '@/lib/axios';
import type { CvProfileSummary } from '@/lib/api';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { cn } from '@/lib/utils';

const MENU_ITEM_CLASS =
  'block w-full px-3.5 py-2.5 text-left text-[14px] text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40';

function scoreTone(score: number): string {
  if (score >= 70) return 'text-success-text';
  if (score >= 50) return 'text-warning-text';
  return 'text-danger-text';
}

type DashboardCvProfilesPanelProps = {
  profiles: CvProfileSummary[];
  isLoading: boolean;
  onNewCv: () => void;
};

export function DashboardCvProfilesPanel({
  profiles,
  isLoading,
  onNewCv,
}: DashboardCvProfilesPanelProps) {
  const toast = useToast();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const duplicate = useDuplicateCVProfile();
  const del = useDeleteCVProfile();
  const setDefault = useSetDefaultCVProfile();
  const rename = useRenameCVProfile();

  const [deleteTarget, setDeleteTarget] = useState<CvProfileSummary | null>(
    null,
  );
  const [renameTarget, setRenameTarget] = useState<CvProfileSummary | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const mergeSelection = useCvProfileMergeSelection(profiles);

  const closeMenu = useCallback(() => {
    setMenuId(null);
    setMenuAnchor(null);
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const onDoc = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuId, closeMenu]);

  useLayoutEffect(() => {
    if (!menuId || !menuAnchor) return;
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menuId, menuAnchor, closeMenu]);

  const openMenu = useCallback(
    (e: ReactMouseEvent, profileId: string) => {
      if (menuId === profileId) {
        closeMenu();
        return;
      }
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setMenuAnchor({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
      setMenuId(profileId);
    },
    [menuId, closeMenu],
  );

  const stopMerging = () => {
    setMergeMode(false);
    mergeSelection.clear();
  };

  const menuProfile = menuId
    ? profiles.find((x) => x.id === menuId)
    : undefined;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton height={112} borderRadius={16} />
        <Skeleton height={112} borderRadius={16} />
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-bg-surface px-6 py-12 text-center">
        <FileText className="h-9 w-9 text-accent-text" strokeWidth={1.5} />
        <p className="mt-3 text-[17px] font-semibold text-text-primary">
          No CVs yet
        </p>
        <p className="mt-1 max-w-xs text-[14px] text-text-secondary">
          Upload the CV you already have, or build one in a few minutes.
        </p>
        <Button
          type="button"
          variant="accent"
          className="mt-5 px-6"
          onClick={onNewCv}
        >
          Create a CV
        </Button>
      </div>
    );
  }

  return (
    <div>
      {mergeMode ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-bg-surface px-4 py-3">
          <p className="text-[14px] text-text-secondary">
            Tick the CVs to combine into a new one. Your originals stay as they
            are.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-3 text-[13px]"
            onClick={stopMerging}
          >
            Cancel
          </Button>
        </div>
      ) : null}

      <CvProfileMergeToolbar
        selectedCount={mergeSelection.selectedList.length}
        canMerge={mergeSelection.canMerge}
        overLimit={mergeSelection.overLimit}
        onClear={mergeSelection.clear}
        onMerge={() => setMergeOpen(true)}
        className="mb-3"
      />

      <ul className="space-y-3">
        {profiles.map((p) => {
          const score =
            p.score !== null && Number.isFinite(p.score) ? p.score : null;
          const editHref = `/dashboard/cv?profileId=${encodeURIComponent(p.id)}`;
          return (
            <li
              key={p.id}
              className={cn(
                'rounded-2xl border bg-bg-surface p-4 sm:p-5',
                p.isDefault ? 'border-accent-border' : 'border-border-subtle',
              )}
            >
              <div className="flex items-start gap-3">
                {mergeMode ? (
                  <CvProfileMergeCheckbox
                    checked={mergeSelection.selectedIds.has(p.id)}
                    disabled={
                      !mergeSelection.selectedIds.has(p.id) &&
                      mergeSelection.selectedList.length >= 6
                    }
                    onChange={() => mergeSelection.toggle(p.id)}
                    label={`Combine ${p.name}`}
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link
                      href={editHref}
                      className="line-clamp-2 min-w-0 break-words text-[16px] font-semibold text-text-primary hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.isDefault ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-subtle px-2 py-0.5 text-[12px] font-semibold text-accent-text">
                        <Star className="h-3 w-3 fill-current" aria-hidden />
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-text-tertiary">
                    {score != null ? (
                      <>
                        Score{' '}
                        <span className={cn('font-semibold', scoreTone(score))}>
                          {score}
                        </span>
                        /100
                      </>
                    ) : (
                      'Not scored yet'
                    )}
                    {' · '}
                    Edited {formatRelativeEdited(p.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`More options for ${p.name}`}
                  aria-haspopup="menu"
                  aria-expanded={menuId === p.id}
                  className="-mr-1 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-tertiary transition hover:bg-bg-hover hover:text-text-primary"
                  onClick={(ev) => openMenu(ev, p.id)}
                >
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Link
                  href={editHref}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-accent-solid px-5 text-[14px] font-semibold text-text-on-accent transition hover:bg-accent-solid-hover"
                >
                  Edit
                </Link>
                <Link
                  href={`${editHref}&download=pdf`}
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border-default px-4 text-[14px] font-semibold text-text-primary transition hover:border-border-strong hover:bg-bg-hover"
                >
                  <FileDown className="h-4 w-4" aria-hidden />
                  Download PDF
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {profiles.length > 1 && !mergeMode ? (
        <button
          type="button"
          className="mt-4 text-[14px] font-medium text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
          onClick={() => setMergeMode(true)}
        >
          Combine CVs into one
        </button>
      ) : null}

      {typeof document !== 'undefined' && menuProfile && menuAnchor
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              className="fixed z-[200] min-w-[12rem] overflow-hidden rounded-xl border border-border-subtle bg-bg-raised py-1 shadow-lg"
              style={{ top: menuAnchor.top, right: menuAnchor.right }}
            >
              {!menuProfile.isDefault ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={
                    setDefault.isPending &&
                    setDefault.variables === menuProfile.id
                  }
                  className={MENU_ITEM_CLASS}
                  onClick={() => {
                    setDefault.mutate(menuProfile.id, {
                      onSuccess: () => {
                        toast.success('Default CV updated');
                        closeMenu();
                      },
                      onError: (e) => toast.error(getApiErrorMessage(e)),
                    });
                  }}
                >
                  Make this my default
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={duplicate.isPending}
                className={MENU_ITEM_CLASS}
                onClick={() => {
                  const id = menuProfile.id;
                  closeMenu();
                  duplicate.mutate(id, {
                    onSuccess: () => toast.success('Copy created'),
                    onError: (e) => toast.error(getApiErrorMessage(e)),
                  });
                }}
              >
                {duplicate.isPending ? (
                  <Loader2 className="inline h-4 w-4 animate-spin" />
                ) : (
                  'Make a copy'
                )}
              </button>
              <button
                type="button"
                role="menuitem"
                className={MENU_ITEM_CLASS}
                onClick={() => {
                  closeMenu();
                  setRenameTarget(menuProfile);
                  setRenameValue(menuProfile.name);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={profiles.length <= 1 || del.isPending}
                title={
                  profiles.length <= 1 ? 'You need at least one CV' : undefined
                }
                className={cn(
                  MENU_ITEM_CLASS,
                  'text-danger-text hover:bg-danger-subtle hover:text-danger-text',
                )}
                onClick={() => {
                  closeMenu();
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
        title="Delete this CV?"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed for good. This can’t be undone.`
            : undefined
        }
        confirmLabel="Delete"
        variant="danger"
        isPending={del.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await del.mutateAsync(deleteTarget.id);
            toast.success('CV deleted');
          } catch (e) {
            toast.error(getApiErrorMessage(e));
            throw e;
          }
        }}
      />

      <Modal
        open={Boolean(renameTarget)}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        title="Rename this CV"
      >
        <input
          type="text"
          aria-label="CV name"
          value={renameValue}
          maxLength={100}
          onChange={(e) => setRenameValue(e.target.value)}
          className="mt-2 w-full rounded-xl border border-border-default bg-bg-sunken px-3 py-2.5 text-[15px] text-text-primary outline-none focus:border-accent-solid"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRenameTarget(null)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            className="h-10 px-5"
            disabled={rename.isPending || !renameTarget || !renameValue.trim()}
            onClick={() => {
              if (!renameTarget) return;
              rename.mutate(
                {
                  id: renameTarget.id,
                  name: renameValue.trim() || renameTarget.name,
                },
                {
                  onSuccess: () => {
                    toast.success('CV renamed');
                    setRenameTarget(null);
                  },
                  onError: (e) => toast.error(getApiErrorMessage(e)),
                },
              );
            }}
          >
            {rename.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </Modal>

      <MergeCvProfilesModal
        open={mergeOpen}
        onOpenChange={(open) => {
          setMergeOpen(open);
          if (!open) stopMerging();
        }}
        profileIds={mergeSelection.selectedList}
        profiles={profiles}
      />
    </div>
  );
}
