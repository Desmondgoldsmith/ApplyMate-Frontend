'use client';

import confetti from 'canvas-confetti';
import { Copy, Download, PartyPopper, Sparkles } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  downloadAchievementShareCardPng,
  renderAchievementShareCardPng,
} from '@/lib/achievementShareCardImage';
import { getDisplayName } from '@/lib/display-name';
import type { CareerAchievementsPayload, TodayPlanAchievementPayload } from '@/lib/today-plan';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

type Props = {
  career: CareerAchievementsPayload | null;
  achievements: TodayPlanAchievementPayload[] | null;
};

function buildShareLines(
  name: string,
  career: CareerAchievementsPayload | null,
  achievements: TodayPlanAchievementPayload[] | null,
): string[] {
  const wins = career?.recentWins?.length
    ? career.recentWins
    : (achievements ?? []).slice(0, 6);
  const lines: string[] = [`${name}'s ApplyMate achievements`, ''];
  if (career?.level?.title?.trim() || career?.level?.number != null) {
    lines.push(
      `Level ${career.level.number ?? ''} ${career.level.title?.trim() ?? ''}`.trim(),
    );
  }
  if (career?.summary?.totalUnlocked != null) {
    lines.push(`${career.summary.totalUnlocked} badges unlocked`);
  }
  lines.push('');
  if (wins.length) {
    lines.push('Recent wins:');
    for (const w of wins.slice(0, 5)) {
      lines.push(
        `• ${w.title?.trim() || 'Achievement'}${w.description?.trim() ? ` — ${w.description.trim()}` : ''}`,
      );
    }
  }
  const almost = career?.almostUnlocked?.slice(0, 3) ?? [];
  if (almost.length) {
    lines.push('', 'Almost there:');
    for (const m of almost) {
      lines.push(`• ${m.title?.trim() || 'Milestone'} (${m.progressCurrent}/${m.progressTarget})`);
    }
  }
  lines.push('', 'Tracked with ApplyMate — applymate.app');
  return lines;
}

export function AchievementCelebrationPanel({ career, achievements }: Props) {
  const { data: me } = useCurrentUser();
  const storeUser = useAuthStore((s) => s.user);
  const displayName = getDisplayName(me ?? storeUser);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const shareText = useMemo(
    () => buildShareLines(displayName, career, achievements).join('\n'),
    [achievements, career, displayName],
  );

  const wins = useMemo(() => {
    if (career?.recentWins?.length) return career.recentWins.slice(0, 4);
    return (achievements ?? []).slice(0, 4);
  }, [achievements, career?.recentWins]);

  const celebrate = useCallback(() => {
    const end = Date.now() + 1200;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors: ['#00C9B1', '#5EEAD4', '#FBBF24', '#A78BFA'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors: ['#00C9B1', '#5EEAD4', '#FBBF24', '#A78BFA'],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  const copySummary = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const downloadCard = async () => {
    setDownloading(true);
    try {
      const targetRole = me?.targetRoles?.[0]?.trim() || storeUser?.targetRoles?.[0]?.trim() || null;
      const blob = await renderAchievementShareCardPng({
        displayName,
        career,
        achievements,
        targetRole,
      });
      downloadAchievementShareCardPng(blob, displayName);
    } catch {
      /* user may block canvas — fail silently */
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-br from-[#00C9B1]/[0.12] via-white/[0.04] to-violet-500/[0.08] p-6 shadow-[0_32px_80px_-40px_rgba(0,201,177,0.35)] sm:p-8">
      <Sparkles className="pointer-events-none absolute right-6 top-6 h-8 w-8 text-amber-300/40" aria-hidden />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5EEAD4]">Your wins</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        {displayName}, you&apos;re on a roll
      </h2>
      {career?.level?.title?.trim() || career?.level?.number != null ? (
        <p className="mt-2 text-[15px] font-medium text-[#00C9B1]">
          {career.level?.number != null ? <>Level {career.level.number} </> : null}
          {career.level?.title?.trim() ?? ''}
        </p>
      ) : null}
      {wins.length > 0 ? (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {wins.map((w, i) => (
            <li
              key={w.key?.trim() || w.title?.trim() || `win-${i}`}
              className={cn(
                'rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-3',
                w.rarity === 'legendary' && 'border-amber-400/35 bg-amber-400/[0.06]',
                w.rarity === 'epic' && 'border-violet-400/30 bg-violet-400/[0.06]',
              )}
            >
              <p className="text-[13px] font-semibold text-white/92">{w.title?.trim() || 'Achievement'}</p>
              {w.description?.trim() ? (
                <p className="mt-1 line-clamp-2 text-[11px] text-white/48">{w.description.trim()}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          className="gap-2 bg-[#00C9B1] text-[#080A0A] hover:bg-[#00C9B1]"
          onClick={celebrate}
        >
          <PartyPopper className="h-4 w-4" aria-hidden />
          Celebrate
        </Button>
        <Button type="button" variant="ghost" className="gap-2 border border-white/12" onClick={() => void copySummary()}>
          <Copy className="h-4 w-4" aria-hidden />
          {copied ? 'Copied!' : 'Copy summary'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="gap-2 border border-white/12"
          disabled={downloading}
          onClick={() => void downloadCard()}
        >
          <Download className="h-4 w-4" aria-hidden />
          {downloading ? 'Preparing image…' : 'Download image'}
        </Button>
      </div>
    </div>
  );
}
