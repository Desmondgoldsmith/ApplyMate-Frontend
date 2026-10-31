'use client';

import {
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Star,
  UploadCloud,
} from 'lucide-react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { PortalThemeScope } from '@/components/theme/ThemeScope';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Modal } from '@/components/ui/Modal';
import { ScrollContentEnd } from '@/components/ui/ScrollContentEnd';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useClientPagination } from '@/hooks/useClientPagination';
import { useDeleteCVProfile } from '@/hooks/useDeleteCVProfile';
import { useRenameCVProfile } from '@/hooks/useRenameCVProfile';
import type { CvProfileSummary } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 9;
/** Search only helps once there are enough CVs to lose one. */
const SEARCH_THRESHOLD = 5;

function norm(s: string) {
  return s.trim().toLowerCase();
}

function ActionTile({
  icon,
  title,
  description,
  onClick,
  primary,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex min-h-[88px] w-full items-center gap-4 rounded-3xl border p-5 text-left shadow-raised transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        primary
          ? 'border-accent-border bg-accent-subtle hover:border-border-focus'
          : 'border-border-subtle bg-bg-surface hover:border-border-strong hover:bg-bg-hover',
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
          primary
            ? 'bg-accent-solid text-text-on-accent'
            : 'bg-bg-sunken text-text-primary',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[17px] font-bold tracking-[-0.01em] text-text-primary">
          {title}
        </span>
        <span className="mt-0.5 block text-[14px] leading-snug text-text-secondary">
          {description}
        </span>
      </span>
    </button>
  );
}

function ProfileActions({
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
  const [menuAnchor, setMenuAnchor] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CvProfileSummary | null>(
    null,
  );
  const [renameTarget, setRenameTarget] = useState<CvProfileSummary | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  useEffect(() => {
    if (!menuAnchor) return;
    const onDoc = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuAnchor, closeMenu]);

  useLayoutEffect(() => {
    if (!menuAnchor) return;
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [menuAnchor, closeMenu]);

  const openMenu = useCallback((e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuAnchor({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, []);

  const menuItemClass =
    'flex min-h-[44px] w-full items-center px-4 text-left text-[14px] transition-colors disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenCv(profile.id)}
          className="gap-1.5 px-4"
        >
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </Button>
        <button
          type="button"
          aria-label={`More actions for ${profile.name}`}
          aria-haspopup="menu"
          aria-expanded={Boolean(menuAnchor)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          onClick={openMenu}
        >
          <MoreVertical className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {typeof document !== 'undefined' && menuAnchor
        ? createPortal(
            <PortalThemeScope>
              <div
                ref={menuRef}
                role="menu"
                className="fixed z-[200] min-w-[11rem] overflow-hidden rounded-2xl border border-border-default bg-bg-raised py-1 shadow-overlay"
                style={{ top: menuAnchor.top, right: menuAnchor.right }}
              >
                <button
                  type="button"
                  role="menuitem"
                  className={cn(
                    menuItemClass,
                    'text-text-primary hover:bg-bg-hover',
                  )}
                  onClick={() => {
                    closeMenu();
                    setRenameTarget(profile);
                    setRenameValue(profile.name);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled={profiles.length <= 1 || del.isPending}
                  title={
                    profiles.length <= 1
                      ? 'You need at least one CV'
                      : undefined
                  }
                  className={cn(
                    menuItemClass,
                    'text-danger-text hover:bg-danger-subtle',
                  )}
                  onClick={() => {
                    closeMenu();
                    setDeleteTarget(profile);
                  }}
                >
                  Delete
                </button>
              </div>
            </PortalThemeScope>,
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
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await del.mutateAsync(deleteTarget.id);
            toast.success('CV deleted');
            setDeleteTarget(null);
          } catch (e) {
            toast.error(getApiErrorMessage(e));
          }
        }}
      />
      <Modal
        open={Boolean(renameTarget)}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        title="Rename CV"
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
                  toast.success('CV renamed');
                  setRenameTarget(null);
                },
                onError: (err) => toast.error(getApiErrorMessage(err)),
              },
            );
          }}
        >
          <label className="block">
            <span className="mb-1.5 block text-[14px] font-semibold text-text-primary">
              Name
            </span>
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={120}
              className="h-12 w-full rounded-xl border border-border-strong bg-bg-sunken px-3.5 text-[15px] text-text-primary outline-none transition-[border-color,box-shadow] focus:border-border-focus focus:shadow-[0_0_0_3px_var(--ck-accent-subtle)]"
              autoFocus
            />
          </label>
          <Button
            type="submit"
            variant="accent"
            fullWidth
            disabled={!renameValue.trim() || rename.isPending}
          >
            {rename.isPending ? 'Saving…' : 'Save name'}
          </Button>
        </form>
      </Modal>
    </>
  );
}

function ProfileCard({
  profile,
  profiles,
  onOpenCv,
}: {
  profile: CvProfileSummary;
  profiles: CvProfileSummary[];
  onOpenCv: (profileId: string) => void;
}) {
  const headline = (profile.headline ?? '').trim();
  return (
    <li className="flex h-full flex-col rounded-3xl border border-border-subtle bg-bg-surface p-5 shadow-raised transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-bg-sunken text-text-secondary">
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenCv(profile.id)}
            className="line-clamp-2 text-left text-[16px] font-semibold leading-snug text-text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          >
            {profile.name}
          </button>
          {headline ? (
            <p className="mt-1 line-clamp-1 text-[14px] text-text-secondary">
              {headline}
            </p>
          ) : null}
        </div>
        {profile.isDefault ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-1 text-[12px] font-semibold text-accent-text">
            <Star className="h-3 w-3" aria-hidden />
            Main CV
          </span>
        ) : null}
      </div>
      <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-text-secondary">
        {profile.score != null ? (
          <div className="flex items-center gap-1">
            <dt className="sr-only">Score</dt>
            <dd className="font-semibold tabular-nums text-text-primary">
              {profile.score}
              <span className="font-normal text-text-tertiary">/100</span>
            </dd>
          </div>
        ) : null}
        {profile.template ? (
          <div>
            <dt className="sr-only">Design</dt>
            <dd className="capitalize">{profile.template} design</dd>
          </div>
        ) : null}
        <div>
          <dt className="sr-only">Last edited</dt>
          <dd>{formatRelativeEdited(profile.updatedAt)}</dd>
        </div>
      </dl>
      <div className="mt-auto flex justify-end pt-4">
        <ProfileActions
          profile={profile}
          profiles={profiles}
          onOpenCv={onOpenCv}
        />
      </div>
    </li>
  );
}

type CvClinicHubProps = {
  profiles: CvProfileSummary[];
  loading?: boolean;
  onNewCv: () => void;
  onUploadCv?: () => void;
  onOpenCv: (profileId: string) => void;
};

/** The My CV start page: start or upload a CV, then pick one to edit. */
export function CvClinicHub({
  profiles,
  loading = false,
  onNewCv,
  onUploadCv,
  onOpenCv,
}: CvClinicHubProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = norm(search);
    if (!q) return profiles;
    return profiles.filter((p) =>
      [p.name, p.headline ?? '', p.location ?? '', p.template ?? '']
        .map(norm)
        .join(' ')
        .includes(q),
    );
  }, [profiles, search]);

  const pagination = useClientPagination(filtered, PAGE_SIZE);
  const showSearch = profiles.length >= SEARCH_THRESHOLD;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-8 pt-2 sm:px-0">
      <header data-tour="cv-clinic-intro">
        <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.03em] text-text-primary sm:text-[36px]">
          My CV
        </h1>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-text-secondary">
          Edit, check and download your CVs. Changes save automatically.
        </p>
      </header>

      <section
        aria-label="Start a CV"
        className={cn('grid gap-3', onUploadCv && 'sm:grid-cols-2')}
        data-tour="cv-clinic-actions"
      >
        <ActionTile
          primary
          icon={<Plus className="h-6 w-6" strokeWidth={2.25} aria-hidden />}
          title="New CV"
          description="Pick a design, then write it with AI or start blank."
          onClick={onNewCv}
        />
        {onUploadCv ? (
          <ActionTile
            icon={<UploadCloud className="h-6 w-6" aria-hidden />}
            title="Upload a CV"
            description="PDF or Word. We’ll read it and score it for you."
            onClick={onUploadCv}
          />
        ) : null}
      </section>

      <section
        aria-labelledby="cv-library-heading"
        data-tour="cv-clinic-library"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="cv-library-heading"
              className="font-display text-[20px] font-bold tracking-[-0.02em] text-text-primary"
            >
              Your CVs
            </h2>
            <p className="mt-0.5 text-[14px] text-text-secondary">
              Open one to edit it.
            </p>
          </div>
          {showSearch ? (
            <label className="relative w-full sm:max-w-xs">
              <span className="sr-only">Search your CVs</span>
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your CVs"
                className="h-11 w-full rounded-xl border border-border-default bg-bg-surface pl-10 pr-3 text-[15px] text-text-primary outline-none transition-[border-color,box-shadow] placeholder:text-text-tertiary focus:border-border-focus focus:shadow-[0_0_0_3px_var(--ck-accent-subtle)]"
              />
            </label>
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={168} borderRadius={24} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border-default bg-bg-surface px-6 py-12 text-center">
            <FileText
              className="mx-auto h-9 w-9 text-text-tertiary"
              aria-hidden
            />
            <p className="mt-3 text-[15px] font-semibold text-text-primary">
              {profiles.length === 0
                ? 'No CVs yet'
                : 'No CVs match that search'}
            </p>
            <p className="mt-1 text-[14px] text-text-secondary">
              {profiles.length === 0
                ? 'Create one or upload the CV you already have.'
                : 'Try a different word, or clear the search.'}
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pagination.pageItems.map((p) => (
              <ProfileCard
                key={p.id}
                profile={p}
                profiles={profiles}
                onOpenCv={onOpenCv}
              />
            ))}
          </ul>
        )}

        {pagination.showPager ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="text-[13px] text-text-secondary">
              {pagination.rangeStart}–{pagination.rangeEnd} of{' '}
              {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pagination.page <= 1}
                onClick={() => pagination.setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  pagination.setPage((p) =>
                    Math.min(pagination.totalPages, p + 1),
                  )
                }
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </section>
      <ScrollContentEnd className="max-lg:h-2" />
    </div>
  );
}
