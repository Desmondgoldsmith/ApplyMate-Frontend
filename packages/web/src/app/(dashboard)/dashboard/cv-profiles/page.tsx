'use client';

import { motion } from 'framer-motion';
import { ChevronDown, FileDown, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CreateCVProfileModal } from '@/components/dashboard/CreateCVProfileModal';
import { DashboardCvProfilesPanel } from '@/components/dashboard/DashboardCvProfilesPanel';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useCVProfileById } from '@/hooks/useCVProfileById';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { openCvPdfInNewTab } from '@/lib/cv-open-pdf-tab';
import { getApiErrorMessage } from '@/lib/axios';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
function CvProfilesPageInner() {
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pdfPending, setPdfPending] = useState(false);
  const { displayRows, listInconsistent, isBootstrapping } =
    useCvProfileRowsDisplay();
  const totalShown = displayRows.length;
  const search = useSearchParams();
  const requestedId = search.get('profileId')?.trim() || null;

  useEffect(() => {
    if (!displayRows.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => {
      if (requestedId && displayRows.some((r) => r.id === requestedId))
        return requestedId;
      if (prev && displayRows.some((r) => r.id === prev)) return prev;
      return displayRows.find((r) => r.isDefault)?.id ?? displayRows[0]!.id;
    });
  }, [displayRows, requestedId]);

  const detailQ = useCVProfileById(selectedId);
  const summaryRow = displayRows.find((r) => r.id === selectedId) ?? null;
  const showProfilePicker = !isBootstrapping && totalShown > 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-0"
    >
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#00C9B1]">
            CV profiles
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-white">
            All your CVs
          </h2>
          <p className="mt-1 text-sm text-white/50">
            {isBootstrapping
              ? 'Loading…'
              : totalShown > 0
                ? `${totalShown} profile${totalShown === 1 ? '' : 's'} — preview, edit, or manage below.`
                : 'Create a profile for each role or industry you target.'}
          </p>
        </div>
        <Button
          type="button"
          className="h-9 shrink-0 gap-1.5 px-3 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          + New CV
        </Button>
      </div>

      {listInconsistent ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-100/90">
          <p className="font-semibold text-amber-50">List mismatch</p>
          <p className="mt-1 text-amber-100/80">
            GET{' '}
            <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">
              /cv/profiles
            </code>{' '}
            returned no rows, but your primary CV exists. Re-running onboarding
            is not required — fix API URL, auth, or server list behavior. You
            can still edit in{' '}
            <Link
              href="/dashboard/cv"
              className="font-semibold text-[#00C9B1] hover:underline"
            >
              CV Clinic
            </Link>
            .
          </p>
        </div>
      ) : null}

      {!isBootstrapping && totalShown > 0 && selectedId && summaryRow ? (
        <GlowCard
          className="min-w-0 border border-[rgba(0,201,177,0.15)]"
          contentClassName="min-w-0 p-5 sm:p-6"
        >
          {showProfilePicker ? (
            <label className="mb-4 block min-w-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">
                Active profile
              </span>
              <div className="relative mt-1.5 min-w-0">
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full min-w-0 appearance-none rounded-xl border border-white/15 bg-[#0C0F0F] py-2.5 pl-3 pr-9 text-sm font-medium text-white outline-none focus:border-[#00C9B1]/50"
                >
                  {displayRows.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.isDefault ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                  aria-hidden
                />
              </div>
            </label>
          ) : null}

          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">
            Preview
          </p>
          {detailQ.isLoading && !detailQ.data ? (
            <div className="mt-3 space-y-2">
              <Skeleton height={20} width="70%" borderRadius={6} />
              <Skeleton height={14} width="50%" borderRadius={6} />
            </div>
          ) : (
            <>
              <p className="mt-2 break-words text-lg font-bold text-white">
                {summaryRow.name}
              </p>
              <p className="mt-1 break-words text-sm text-white/55">
                {detailQ.data?.profile?.headline?.trim() ||
                  summaryRow.headline?.trim() ||
                  'No headline yet'}
              </p>
              {(
                detailQ.data?.profile?.location ?? summaryRow.location
              )?.trim() ? (
                <p className="mt-1 break-words text-xs text-white/45">
                  {(detailQ.data?.profile?.location ??
                    summaryRow.location)!.trim()}
                </p>
              ) : null}
              <p className="mt-2 break-words text-xs text-white/45">
                {summaryRow.score != null && Number.isFinite(summaryRow.score)
                  ? `Score ${summaryRow.score}/100`
                  : 'Not scored yet'}
                {' · '}
                Template:{' '}
                <span className="text-white/70">
                  {summaryRow.template ?? '—'}
                </span>
                {' · '}
                Sections:{' '}
                <span className="text-white/70">
                  {detailQ.data?.sections?.length ?? '—'}
                </span>
                {' · '}
                Updated {formatRelativeEdited(summaryRow.updatedAt)}
              </p>
              <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Link
                  href={`/dashboard/cv?profileId=${encodeURIComponent(selectedId)}`}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#00C9B1] px-4 py-2.5 text-xs font-semibold text-[#080A0A] transition hover:bg-[#00C9B1] sm:w-auto"
                >
                  Open in CV builder →
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pdfPending}
                  className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[rgba(0,201,177,0.35)] px-4 py-2.5 text-xs font-semibold text-[#00C9B1] hover:bg-[rgba(0,201,177,0.12)] sm:w-auto"
                  onClick={() => {
                    setPdfPending(true);
                    void openCvPdfInNewTab(
                      selectedId,
                      summaryRow.template ?? undefined,
                    )
                      .catch((e: unknown) => toast.error(getApiErrorMessage(e)))
                      .finally(() => setPdfPending(false));
                  }}
                >
                  {pdfPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileDown className="h-3.5 w-3.5" />
                  )}
                  View PDF
                </Button>
              </div>
            </>
          )}
        </GlowCard>
      ) : null}

      <DashboardCvProfilesPanel
        profiles={displayRows}
        isLoading={isBootstrapping}
        onNewCv={() => setCreateOpen(true)}
      />

      <CreateCVProfileModal open={createOpen} onOpenChange={setCreateOpen} />
    </motion.div>
  );
}

export default function CvProfilesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-6">
          <Skeleton height={28} width={200} borderRadius={8} />
          <Skeleton height={120} width="100%" borderRadius={12} />
        </div>
      }
    >
      <CvProfilesPageInner />
    </Suspense>
  );
}
