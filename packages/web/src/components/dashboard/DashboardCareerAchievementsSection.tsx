'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type {
  CareerAchievementsPayload,
  DashboardEmptyStatePayload,
  TodayPlanAchievementPayload,
  TodayPlanAchievementRarity,
} from '@/lib/today-plan';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'applymate-career-achievement-win-ids';

type Props = {
  digestVersion: string;
  career: CareerAchievementsPayload | null;
  achievements: TodayPlanAchievementPayload[] | null;
  /** From `normalizedSectionTitles` (`career_achievements` / `achievements`) when provided. */
  heading: string;
  phase15Empty?: DashboardEmptyStatePayload | null;
  /** Full achievements page shows more rows and hides the dashboard “view all” link. */
  variant?: 'dashboard' | 'page';
  maxWins?: number;
  maxAlmost?: number;
};

function rarityStyles(rarity: TodayPlanAchievementRarity | null): string {
  switch (rarity) {
    case 'legendary':
      return 'border-amber-400/40 bg-gradient-to-br from-amber-400/[0.14] to-white/[0.02] shadow-[0_0_28px_-10px_rgba(251,191,36,0.45)]';
    case 'epic':
      return 'border-violet-400/40 bg-gradient-to-br from-violet-400/[0.12] to-white/[0.02] shadow-[0_0_22px_-10px_rgba(167,139,250,0.35)]';
    case 'rare':
      return 'border-sky-400/35 bg-sky-400/[0.06]';
    case 'common':
    default:
      return 'border-white/[0.1] bg-white/[0.03]';
  }
}

function winKey(a: TodayPlanAchievementPayload, i: number): string {
  return (a.key?.trim() || a.title?.trim() || `win-${i}`) + String(i);
}

export function DashboardCareerAchievementsSection({
  digestVersion,
  career,
  achievements,
  heading,
  phase15Empty,
  variant = 'dashboard',
  maxWins = 3,
  maxAlmost = 3,
}: Props) {
  const hasCareerBundle = career != null;

  const wins = useMemo(() => {
    if (career?.recentWins?.length) return career.recentWins.slice(0, maxWins);
    return (achievements ?? []).slice(0, maxWins);
  }, [career?.recentWins, achievements, maxWins]);

  const milestones = useMemo(() => {
    if (!hasCareerBundle) return [];
    return (career?.almostUnlocked ?? []).slice(0, maxAlmost);
  }, [career?.almostUnlocked, hasCareerBundle, maxAlmost]);

  const summaryChips = useMemo(() => {
    const s = career?.summary;
    if (!s) return [] as { label: string; value: string }[];
    const chips: { label: string; value: string }[] = [];
    if (s.totalUnlocked != null) chips.push({ label: 'Unlocked', value: String(s.totalUnlocked) });
    if (s.rareCount != null && s.rareCount > 0) chips.push({ label: 'Rare', value: String(s.rareCount) });
    if (s.epicCount != null && s.epicCount > 0) chips.push({ label: 'Epic', value: String(s.epicCount) });
    if (s.legendaryCount != null && s.legendaryCount > 0) chips.push({ label: 'Legendary', value: String(s.legendaryCount) });
    return chips;
  }, [career?.summary]);

  const legacyLine = career?.legacyBadgeSummaryLine?.trim() ?? '';
  const viewAllHref = (career?.viewAllHref?.trim() || '/dashboard/career-achievements') as string;

  const xp = career?.experiencePoints;
  const xpPct = useMemo(() => {
    if (!xp?.nextLevelAt || xp.nextLevelAt < 1) return null;
    const cur = xp.current ?? 0;
    return Math.min(100, Math.round((cur / xp.nextLevelAt) * 100));
  }, [xp]);

  const showLevel =
    hasCareerBundle && (career?.level?.number != null || Boolean(career?.level?.title?.trim()));
  const showAlmost = hasCareerBundle && milestones.length > 0;
  const showXp =
    hasCareerBundle &&
    xp != null &&
    ((xp.current != null && xp.current >= 0) || (xp.nextLevelAt != null && xp.nextLevelAt > 0));
  const showSummaryRow = summaryChips.length > 0 || Boolean(legacyLine);

  const winKeys = useMemo(() => wins.map((w, i) => winKey(w, i)), [wins]);
  const [sparkleIds, setSparkleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || !digestVersion || winKeys.length === 0) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as { digest: string; ids: string[] }) : null;
      const sameDigest = parsed?.digest === digestVersion;
      const known = new Set(sameDigest ? (parsed?.ids ?? []) : []);
      const fresh = winKeys.filter((k) => !known.has(k));
      if (fresh.length > 0) setSparkleIds(new Set(fresh));
      const merged = new Set([...known, ...winKeys]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ digest: digestVersion, ids: [...merged] }));
    } catch {
      /* ignore */
    }
  }, [digestVersion, winKeys.join('|')]);

  useEffect(() => {
    if (!sparkleIds.size) return;
    const t = window.setTimeout(() => setSparkleIds(new Set()), 2800);
    return () => window.clearTimeout(t);
  }, [sparkleIds]);

  const list = achievements ?? [];
  const showEmptyBlock =
    wins.length === 0 && !showAlmost && !showLevel && !showXp && !showSummaryRow;

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.015] p-5 shadow-[0_24px_56px_-36px_rgba(0,201,177,0.12)] ring-1 ring-white/[0.06] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-white/95">
            <span className="mr-1.5" aria-hidden>
              🏆
            </span>
            {heading}
          </h2>
          {showLevel && career ? (
            <p className="mt-2 text-[18px] font-semibold text-[#00C9B1]">
              {career.level?.number != null ? <>Level {career.level.number} </> : null}
              {career.level?.title?.trim() ?? ''}
            </p>
          ) : null}

          {showSummaryRow ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {summaryChips.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/70"
                >
                  <span className="text-white/40">{c.label}</span>
                  <span className="tabular-nums text-white/90">{c.value}</span>
                </span>
              ))}
              {legacyLine && !summaryChips.length ? (
                <p className="text-[13px] leading-relaxed text-white/55">{legacyLine}</p>
              ) : null}
            </div>
          ) : null}

          {legacyLine && summaryChips.length > 0 ? (
            <p className="mt-2 text-[12px] leading-relaxed text-white/45">{legacyLine}</p>
          ) : null}
        </div>
      </div>

      {showXp && xp ? (
        <div className="mt-5">
          <div className="flex items-baseline justify-between gap-2 text-[11px] font-medium text-white/50">
            <span className="uppercase tracking-[0.12em]">Career XP</span>
            <span className="tabular-nums text-white/65">
              {xp.current ?? 0}
              {xp.nextLevelAt != null && xp.nextLevelAt > 0 ? (
                <>
                  {' '}
                  <span className="text-white/35">/</span> {xp.nextLevelAt}
                </>
              ) : null}
            </span>
          </div>
          {xpPct != null ? (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/80 to-[#5EEAD4]/70 transition-[width] duration-500 ease-out"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {showEmptyBlock ? (
        <p className="mt-5 text-[13px] leading-relaxed text-white/45">
          {phase15Empty?.message?.trim() ||
            'Your first badge is one analysis away. Analyze any job to earn your first win.'}
        </p>
      ) : (
        <>
          {wins.length > 0 ? (
            <div className="mt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Recent wins</p>
              <ul className="mt-3 space-y-2.5">
                {wins.map((w, i) => {
                  const k = winKey(w, i);
                  const title = w.title?.trim() || 'Achievement';
                  const sparkle = sparkleIds.has(k);
                  const desc = w.description?.trim() ?? '';
                  return (
                    <li
                      key={k}
                      className={cn(
                        'rounded-xl border p-3.5 transition-[box-shadow,transform] duration-500 ease-out',
                        rarityStyles(w.rarity ?? null),
                        sparkle &&
                          'motion-reduce:transform-none motion-reduce:shadow-none scale-[1.02] shadow-[0_0_24px_-8px_rgba(0,201,177,0.45)]',
                      )}
                    >
                      <p className="text-[13px] font-semibold leading-snug text-white/95">{title}</p>
                      {desc ? (
                        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-white/48">{desc}</p>
                      ) : null}
                      {w.rarity && (w.rarity === 'rare' || w.rarity === 'epic' || w.rarity === 'legendary') ? (
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
                          {w.rarity}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {showAlmost ? (
            <div className="mt-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">Almost unlocked</p>
              <ul className="mt-3 space-y-3">
                {milestones.map((m, i) => {
                  const pct = Math.min(
                    100,
                    Math.round((m.progressCurrent / Math.max(1, m.progressTarget)) * 100),
                  );
                  const mk = m.key?.trim() || `m-${i}-${m.title}`;
                  return (
                    <li
                      key={mk}
                      className={cn(
                        'rounded-xl border p-3.5',
                        m.rarity ? rarityStyles(m.rarity) : 'border-white/[0.08] bg-white/[0.03]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-white/90">{m.title?.trim() || 'Milestone'}</p>
                        <span className="shrink-0 tabular-nums text-[11px] text-white/45">
                          {m.progressCurrent}/{m.progressTarget}
                        </span>
                      </div>
                      {m.description?.trim() ? (
                        <p className="mt-1 text-[11px] text-white/45">{m.description.trim()}</p>
                      ) : null}
                      {m.remaining != null && m.remaining > 0 ? (
                        <p className="mt-1 text-[10px] text-white/35">{m.remaining} to go</p>
                      ) : null}
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/80 to-[#5EEAD4]/70 transition-[width] duration-500 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}

      {variant === 'dashboard' ? (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href={viewAllHref}
            className="inline-flex min-h-[40px] cursor-pointer items-center text-[13px] font-semibold text-[#00C9B1] transition-colors hover:underline"
          >
            View all achievements →
          </Link>
          {list.length === 0 && phase15Empty?.ctaHref ? (
            <Link
              href={phase15Empty.ctaHref.trim() || '/dashboard/jobs/analyze'}
              className="text-[12px] font-medium text-white/50 hover:text-[#00C9B1]"
            >
              {phase15Empty.ctaLabel?.trim() || 'Get started'}
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
