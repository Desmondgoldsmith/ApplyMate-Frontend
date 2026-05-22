'use client';

import Link from 'next/link';

import type {
  DashboardEmptyStatePayload,
  TodayPlanAchievementPayload,
  TodayPlanAchievementRarity,
} from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  achievements: TodayPlanAchievementPayload[] | null | undefined;
  phase15Empty?: DashboardEmptyStatePayload | null;
};

function achievementEmoji(title: string, key: string | null): string {
  const hay = `${title} ${key ?? ''}`.toLowerCase();
  if (hay.includes('first analysis')) return '🔍';
  if (hay.includes('first application')) return '🚀';
  if (hay.includes('first interview')) return '🎤';
  if (hay.includes('85') || hay.includes('cv score')) return '⭐';
  if (hay.includes('10') && hay.includes('job')) return '🎯';
  if (hay.includes('analyzed')) return '🎯';
  return '🏅';
}

function shortBadgeDescription(raw: string): string {
  const w = raw.trim().split(/\s+/).filter(Boolean);
  return w.slice(0, 6).join(' ');
}

function rarityStyles(rarity: TodayPlanAchievementRarity | null): string {
  switch (rarity) {
    case 'legendary':
      return 'border-amber-400/35 bg-gradient-to-br from-amber-400/[0.12] to-white/[0.02] shadow-[0_0_28px_-10px_rgba(251,191,36,0.35)]';
    case 'epic':
      return 'border-violet-400/35 bg-gradient-to-br from-violet-400/[0.1] to-white/[0.02]';
    case 'rare':
      return 'border-sky-400/28 bg-white/[0.03]';
    case 'common':
    default:
      return 'border-white/[0.08] bg-white/[0.02]';
  }
}

export function DashboardAchievementsCard({ achievements, phase15Empty }: Props) {
  const list = achievements ?? [];
  const rows = list.slice(0, 6);
  const earned = list.length;

  return (
    <section className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 shadow-[0_20px_48px_-36px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.05] sm:p-6">
      <p className="text-[11px] font-medium tracking-wide text-white/38">Achievements</p>
      <p className="mt-2 text-[15px] font-semibold text-white/90">
        Recent badges
        {earned > 0 ? (
          <span className="ml-2 text-[13px] font-medium text-white/45">
            · {earned} badge{earned === 1 ? '' : 's'} earned
          </span>
        ) : null}
      </p>

      {rows.length === 0 ? (
        <p className="mt-4 text-[13px] leading-relaxed text-white/45">
          {phase15Empty?.message?.trim() ||
            "Your first badge is one analysis away. Analyze any job to earn 'First Analysis.'"}
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3">
          {rows.map((item, index) => {
            const rawTitle = item.title?.trim() || 'Achievement';
            const displayTitle =
              /^cv above 85$/i.test(rawTitle) || /^cv score 85\+$/i.test(rawTitle)
                ? '⭐ CV Score 85+'
                : /^10 jobs analyzed$/i.test(rawTitle)
                  ? '🎯 10 Jobs Analyzed'
                  : `${achievementEmoji(rawTitle, item.key ?? null)} ${rawTitle}`;
            const description = item.description?.trim() || '';
            const key = item.key?.trim() || `${rawTitle}-${index}`;
            return (
              <li key={key} className={cn('rounded-xl border p-4 transition-colors', rarityStyles(item.rarity ?? null))}>
                <p className="text-[13px] font-semibold leading-snug text-white/90">{displayTitle}</p>
                {description ? (
                  <p className="mt-2 text-[12px] leading-relaxed text-white/50">{shortBadgeDescription(description)}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {rows.length === 0 ? (
        <Link
          href={phase15Empty?.ctaHref?.trim() || '/dashboard/jobs/analyze'}
          className="mt-4 inline-flex min-h-[44px] items-center text-[13px] font-semibold text-[#00C9B1] hover:underline"
        >
          {phase15Empty?.ctaLabel?.trim() || 'Analyze a job →'}
        </Link>
      ) : null}
    </section>
  );
}
