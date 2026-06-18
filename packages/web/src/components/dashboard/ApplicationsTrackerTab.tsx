'use client';

import { useMutation } from '@tanstack/react-query';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { GlowCard } from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/Button';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { useToast } from '@/components/ui/Toast';
import { useApplications } from '@/hooks/useApplications';
import { useUpdateApplicationStatus } from '@/hooks/useApplicationMutations';
import {
  api,
  type ApplicationItem,
  type ApplicationTrackerStatus,
  type FollowUpEmailDraft,
} from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { value: ApplicationTrackerStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'researching', label: 'Researching' },
  { value: 'ready_to_apply', label: 'Ready to apply' },
  { value: 'applied', label: 'Applied' },
  { value: 'interview_scheduled', label: 'Interview scheduled' },
  { value: 'interviewed', label: 'Interviewed' },
  { value: 'offer_received', label: 'Offer received' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'ghosted', label: 'Ghosted' },
];

function statusBadgeClass(status: ApplicationTrackerStatus | undefined): string {
  switch (status) {
    case 'draft':
    case 'researching':
    case 'ready_to_apply':
      return 'border-[#00C9B1]/35 bg-[#00C9B1]/12 text-[#00C9B1]';
    case 'applied':
      return 'border-sky-400/35 bg-sky-500/15 text-sky-200';
    case 'interview_scheduled':
      return 'border-purple-400/35 bg-purple-500/15 text-purple-200';
    case 'interviewed':
      return 'border-indigo-400/35 bg-indigo-500/15 text-indigo-200';
    case 'offer_received':
      return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200';
    case 'rejected':
      return 'border-rose-400/35 bg-rose-500/15 text-rose-200';
    case 'withdrawn':
    case 'ghosted':
      return 'border-white/15 bg-white/[0.06] text-white/45';
    default:
      return 'border-white/15 bg-white/[0.06] text-white/55';
  }
}

function statusLabel(status: ApplicationTrackerStatus | undefined): string {
  const row = STATUS_OPTIONS.find((o) => o.value === status);
  return row?.label ?? (status ? String(status) : 'Unknown');
}

function daysSinceCreated(iso: string | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  return (Date.now() - t) / 86_400_000;
}

function formatSavedDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function ApplicationsTrackerTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId =
    searchParams.get('applicationId') ?? searchParams.get('appId') ?? searchParams.get('application_id');

  const apps = useApplications();
  const toast = useToast();
  const updateStatus = useUpdateApplicationStatus();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [followUpAppId, setFollowUpAppId] = useState<string | null>(null);
  const [followUpDraft, setFollowUpDraft] = useState<FollowUpEmailDraft | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const followUpMutation = useMutation({
    mutationFn: (id: string) => api.applications.getFollowUpDraft(id),
    onSuccess: (draft) => {
      setFollowUpDraft(draft);
      setFollowUpError(null);
    },
    onError: (err) => {
      setFollowUpError(getApiErrorMessage(err));
    },
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!openMenuId) return;
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest(`[data-status-trigger-id="${openMenuId}"]`)
      ) {
        return;
      }
      const el = menuRef.current;
      if (el && !el.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [openMenuId]);

  const list = apps.data ?? [];

  useEffect(() => {
    if (!highlightId) return;
    const el = cardRefs.current[highlightId];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => el.focus({ preventScroll: true }), 250);
  }, [highlightId, list]);

  const handleStatusSelect = useCallback(
    (id: string, status: ApplicationTrackerStatus) => {
      setStatusError(null);
      setOpenMenuId(null);
      updateStatus.mutate(
        { id, status },
        {
          onSuccess: (item) => {
            if (status === 'interview_scheduled' && item.interviewPrepAvailable) {
              toast.success('🎉 Interview scheduled! Want to prep with mock questions?', {
                label: 'Start prep →',
                onClick: () => router.push('/dashboard/jobs'),
              });
            }
          },
          onError: (err) => setStatusError(getApiErrorMessage(err)),
        },
      );
    },
    [router, toast, updateStatus],
  );

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  if (apps.isLoading) {
    return (
      <div className="grid gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <GlowCard contentClassName="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
        <p className="text-lg font-semibold text-white">No applications yet</p>
        <p className="mt-2 max-w-md text-sm text-white/45">
          Run a job analysis from the Analyze tab — your matches and tailored CVs appear here.
        </p>
        <Button className="mt-6" onClick={() => router.replace('/dashboard/jobs')}>
          Analyze a Job →
        </Button>
      </GlowCard>
    );
  }

  return (
    <div className="space-y-3">
      {statusError ? (
        <p className="rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {statusError}
        </p>
      ) : null}

      {list.map((item) => (
        <div
          key={item.id}
          id={`application-${item.id}`}
          tabIndex={highlightId === item.id ? -1 : undefined}
          ref={(el) => {
            cardRefs.current[item.id] = el;
          }}
          className="outline-none"
        >
          <ApplicationCard
            item={item}
            highlighted={highlightId === item.id}
            menuRef={openMenuId === item.id ? menuRef : undefined}
            menuOpen={openMenuId === item.id}
            onToggleMenu={() => setOpenMenuId((prev) => (prev === item.id ? null : item.id))}
            onSelectStatus={(s) => handleStatusSelect(item.id, s)}
            statusPending={updateStatus.isPending && updateStatus.variables?.id === item.id}
            onFollowUp={() => {
              setFollowUpAppId(item.id);
              setFollowUpDraft(null);
              setFollowUpError(null);
              followUpMutation.mutate(item.id);
            }}
          />
        </div>
      ))}

      {followUpAppId ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={() => setFollowUpAppId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0C0F0F] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 px-4 py-3">
              <p className="text-sm font-semibold text-white">Follow-up email</p>
              <p className="text-xs text-white/45">Send this from your own email client</p>
            </div>
            <div className="max-h-[min(60vh,420px)] space-y-3 overflow-y-auto p-4">
              {followUpMutation.isPending ? (
                <div className="flex items-center gap-2 py-8 text-sm text-white/60">
                  <Loader2 className="h-5 w-5 animate-spin text-[#00C9B1]" />
                  Generating draft…
                </div>
              ) : followUpError ? (
                <p className="text-sm text-rose-300">{followUpError}</p>
              ) : followUpDraft ? (
                <>
                  <div>
                    <p className="text-xs font-semibold text-white/50">Subject</p>
                    <p className="mt-1 text-sm text-white/90">{followUpDraft.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/50">Body</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{followUpDraft.body}</p>
                  </div>
                </>
              ) : null}
            </div>
            <div className="flex flex-col gap-2 border-t border-white/10 p-4 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 border border-white/10"
                disabled={!followUpDraft}
                onClick={() => followUpDraft && void copyText('Subject', followUpDraft.subject)}
              >
                Copy subject
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1 border border-white/10"
                disabled={!followUpDraft}
                onClick={() => followUpDraft && void copyText('Email body', followUpDraft.body)}
              >
                Copy email body
              </Button>
              <Button type="button" className="sm:ml-auto" onClick={() => setFollowUpAppId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationCard({
  item,
  highlighted,
  menuRef,
  menuOpen,
  onToggleMenu,
  onSelectStatus,
  statusPending,
  onFollowUp,
}: {
  item: ApplicationItem;
  highlighted?: boolean;
  menuRef?: RefObject<HTMLDivElement | null>;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onSelectStatus: (s: ApplicationTrackerStatus) => void;
  statusPending?: boolean;
  onFollowUp: () => void;
}) {
  const router = useRouter();
  const current = item.status ?? 'applied';
  const showFollowUp =
    current === 'applied' && daysSinceCreated(item.createdAt) > 7;
  const statusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; minWidth: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      setMenuCoords(null);
      return;
    }

    const updatePosition = () => {
      const trigger = statusTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuMinWidth = 192;
      const viewportPadding = 12;
      let left = rect.right - menuMinWidth;
      left = Math.max(viewportPadding, left);
      left = Math.min(left, window.innerWidth - menuMinWidth - viewportPadding);
      setMenuCoords({
        top: rect.bottom + 6,
        left,
        minWidth: menuMinWidth,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [menuOpen]);

  return (
    <GlowCard
      className={cn(highlighted && 'notification-card-highlight [--rotate-duration:3.8s]')}
      contentClassName={cn(
        'p-4',
        highlighted &&
          'ring-2 ring-[#00C9B1]/80 ring-offset-2 ring-offset-[#060A0A] bg-[linear-gradient(180deg,rgba(0,201,177,0.14),rgba(0,201,177,0.05))]',
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 gap-3">
            <CompanyLogo company={item.company} logoUrl={item.companyLogoUrl} size="md" />
            <div className="min-w-0">
            {highlighted ? (
              <span className="mb-1 inline-flex w-fit items-center rounded-md border border-[#00C9B1]/45 bg-[#00C9B1]/18 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#86FFFF]">
                From notification
              </span>
            ) : null}
            <p className="text-sm font-semibold text-white">{item.title}</p>
            <p className="text-[13px] text-white/45">{item.company}</p>
            {item.createdAt ? (
              <p className="mt-1 text-xs text-white/35">Applied {formatSavedDate(item.createdAt)}</p>
            ) : null}
            </div>
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              ref={statusTriggerRef}
              type="button"
              onClick={onToggleMenu}
              disabled={statusPending}
              data-status-trigger-id={item.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/[0.04]',
                statusBadgeClass(current),
              )}
            >
              {statusLabel(current)}
              {statusPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin opacity-80" />
              ) : (
                <ChevronDown className={cn('h-3.5 w-3.5 opacity-70', menuOpen && 'rotate-180')} />
              )}
            </button>
            {menuOpen && menuCoords
              ? createPortal(
                  <div
                    ref={menuRef}
                    className="fixed z-[220] max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#111616] py-1 shadow-lg"
                    style={{ top: menuCoords.top, left: menuCoords.left, minWidth: menuCoords.minWidth }}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onSelectStatus(opt.value)}
                        className={cn(
                          'block w-full px-3 py-2 text-left text-xs text-white/85 hover:bg-white/[0.06]',
                          opt.value === current && 'bg-[#00C9B1]/10 text-[#00C9B1]',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>,
                  document.body,
                )
              : null}
          </div>
        </div>
        {typeof item.matchScore === 'number' && Number.isFinite(item.matchScore) ? (
          <p className="text-xs text-white/50">
            Match score: <span className="font-semibold text-white/80">{Math.round(item.matchScore)}%</span>
          </p>
        ) : null}
        {showFollowUp ? (
          <div>
            <Button type="button" variant="ghost" className="border border-white/10 text-xs" onClick={onFollowUp}>
              Get follow-up email
            </Button>
          </div>
        ) : null}
        {item.jobAnalysisId ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/jobs?jobId=${encodeURIComponent(item.jobAnalysisId!)}`)
              }
              className="text-xs font-medium text-[#00C9B1] underline-offset-2 hover:underline"
            >
              View Analysis →
            </button>
          </div>
        ) : null}
      </div>
    </GlowCard>
  );
}
