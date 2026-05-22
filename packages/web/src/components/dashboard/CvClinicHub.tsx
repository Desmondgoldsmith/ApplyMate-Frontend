'use client';

import {
  Briefcase,
  FileText,
  History,
  LayoutGrid,
  List,
  Plus,
  ScrollText,
  Search,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import { GlowCard } from '@/components/ui/GlowCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useJobHistory } from '@/hooks/useJobHistory';
import { ensureArray } from '@/lib/ensure-array';
import type { CvProfileSummary, JobHistoryItem } from '@/lib/api';
import { formatRelativeEdited } from '@/lib/format-relative-edited';
import { cn } from '@/lib/utils';

const ACTION_TILE =
  'group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#0f1414] to-[#0a0d0d] p-6 text-left shadow-[0_0_0_1px_rgba(0,201,177,0.06)] transition hover:border-[#00C9B1]/35 hover:shadow-[0_12px_40px_-12px_rgba(0,201,177,0.22)]';

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
          'flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition group-hover:opacity-95',
          iconWrapClassName,
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-base font-bold text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">{description}</p>
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
          'flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition group-hover:opacity-95',
          iconWrapClassName,
        )}
      >
        {icon}
      </span>
      <div>
        <p className="text-base font-bold text-white">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">{description}</p>
      </div>
    </Link>
  );
}

type CvClinicHubProps = {
  profiles: CvProfileSummary[];
  loading?: boolean;
  onNewCv: () => void;
  onOpenUpload: () => void;
  onOpenCv: (profileId: string) => void;
  onOpenJobs: () => void;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function CvClinicHub({
  profiles,
  loading = false,
  onNewCv,
  onOpenUpload,
  onOpenCv,
  onOpenJobs,
}: CvClinicHubProps) {
  const history = useJobHistory();
  const jobItems = ensureArray<JobHistoryItem>(history.data);

  const [cvSearch, setCvSearch] = useState('');
  const [clSearch, setClSearch] = useState('');
  const [cvView, setCvView] = useState<ViewMode>('cards');
  const [clView, setClView] = useState<ViewMode>('cards');

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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 pb-12 pt-2">
      <header className="space-y-2" data-tour="cv-clinic-intro">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00C9B1]">CV workspace</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">What would you like to do?</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-white/50">
          Start a CV, upload an existing one, or jump to jobs and analyses. Open anything below to keep editing — your
          work saves automatically.
        </p>
      </header>

      <section aria-label="Quick actions" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="cv-clinic-actions">
        <HubActionTile
          icon={<Plus className="h-6 w-6" strokeWidth={2.25} />}
          iconWrapClassName="bg-[#00C9B1]/15 text-[#00C9B1] ring-[#00C9B1]/25 group-hover:bg-[#00C9B1]/25"
          title="New CV"
          description="Name, template choice, then build with AI, upload, or from scratch"
          onClick={onNewCv}
        />
        <HubActionLink
          href="/dashboard/analyses"
          icon={<History className="h-6 w-6" />}
          iconWrapClassName="bg-emerald-500/10 text-emerald-300 ring-emerald-400/25 group-hover:bg-emerald-500/15"
          title="Analysis history"
          description="Every job you ran — match scores, notes, and saved cover letters"
        />
        <HubActionTile
          icon={<Sparkles className="h-6 w-6" />}
          iconWrapClassName="bg-violet-500/10 text-violet-300 ring-violet-400/20 group-hover:bg-violet-500/15"
          title="Upload CV"
          description="We parse your file and fill the builder for you"
          onClick={onOpenUpload}
        />
        <HubActionTile
          icon={<ScrollText className="h-6 w-6" />}
          iconWrapClassName="bg-amber-500/10 text-amber-200 ring-amber-400/25 group-hover:bg-amber-500/15"
          title="New cover letter"
          description="Analyze a job — we match your CV and draft a letter"
          onClick={onOpenJobs}
        />
      </section>

      <section aria-labelledby="cv-library-heading" className="space-y-4" data-tour="cv-clinic-library">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="cv-library-heading" className="text-lg font-bold text-white sm:text-xl">
              Recent CVs
            </h2>
            <p className="mt-0.5 text-sm text-white/45">Open a CV to enter the CV Clinic editor</p>
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

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={140} borderRadius={16} />
            ))}
          </div>
        ) : filteredProfiles.length === 0 ? (
          <GlowCard className="border border-white/[0.08]" contentClassName="p-10 text-center">
            <FileText className="mx-auto h-10 w-10 text-white/20" />
            <p className="mt-3 text-sm font-medium text-white/70">No CVs match your search</p>
            <p className="mt-1 text-xs text-white/40">Try another term or clear the search box</p>
          </GlowCard>
        ) : cvView === 'cards' ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProfiles.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => onOpenCv(p.id)}
                  className="group flex h-full w-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-5 text-left transition hover:border-[#00C9B1]/35 hover:shadow-[0_8px_32px_-8px_rgba(0,201,177,0.2)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 font-semibold text-white group-hover:text-[#00C9B1]">{p.name}</p>
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
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <GlowCard className="overflow-hidden border border-white/[0.08]" contentClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.03] text-[11px] font-semibold uppercase tracking-wide text-white/45">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Headline</th>
                    <th className="px-4 py-3">Template</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.05] transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-white/50">{p.headline?.trim() || '—'}</td>
                      <td className="px-4 py-3 capitalize text-white/55">{p.template ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-[#00C9B1]">{p.score != null ? `${p.score}/100` : '—'}</td>
                      <td className="px-4 py-3 text-white/40">
                        {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenCv(p.id)}
                          className="rounded-lg border border-[#00C9B1]/35 bg-[#00C9B1]/10 px-3 py-1.5 text-xs font-semibold text-[#00C9B1] transition hover:bg-[#00C9B1]/20"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlowCard>
        )}
      </section>

      <section aria-labelledby="cl-heading" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="cl-heading" className="text-lg font-bold text-white sm:text-xl">
              Cover letters
            </h2>
            <p className="mt-0.5 text-sm text-white/45">Saved with job analyses — open to view or edit in Jobs</p>
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
          <GlowCard className="border border-white/[0.08]" contentClassName="p-10 text-center">
            <ScrollText className="mx-auto h-10 w-10 text-white/20" />
            <p className="mt-3 text-sm font-medium text-white/70">
              {coverLetterRows.length === 0 ? 'No saved cover letters yet' : 'No matches for your search'}
            </p>
            <p className="mt-1 text-xs text-white/40">
              {coverLetterRows.length === 0
                ? 'Run a job analysis and generate a letter — it will show up here.'
                : 'Try another company or role keyword.'}
            </p>
            <button
              type="button"
              onClick={onOpenJobs}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#00C9B1] px-4 py-2.5 text-sm font-semibold text-[#080A0A] transition hover:bg-[#00C9B1]"
            >
              <Briefcase className="h-4 w-4" />
              Go to Jobs
            </button>
            <p className="mt-4 text-[11px] text-white/30">
              Or browse{' '}
              <Link href="/dashboard/analyses" className="text-[#00C9B1] hover:underline">
                all job analyses
              </Link>
              .
            </p>
          </GlowCard>
        ) : clView === 'cards' ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLetters.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/dashboard/jobs?jobId=${encodeURIComponent(j.id)}`}
                  className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-transparent p-5 transition hover:border-[#00C9B1]/35 hover:shadow-[0_8px_32px_-8px_rgba(0,201,177,0.2)]"
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
                  {filteredLetters.map((j) => (
                    <tr key={j.id} className="border-b border-white/[0.05] transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{j.company || '—'}</td>
                      <td className="max-w-[220px] truncate px-4 py-3 text-white/55">{j.jobTitle || j.title || '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-white/60">{j.matchScore ?? '—'}%</td>
                      <td className="px-4 py-3 text-white/40">
                        {j.createdAt ? new Date(j.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/jobs?jobId=${encodeURIComponent(j.id)}`}
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
      </section>
    </div>
  );
}
