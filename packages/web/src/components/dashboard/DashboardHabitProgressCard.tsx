'use client';

import { InfoHint } from '@/components/ui/InfoHint';
import { TOOLTIP_DAILY_STREAK } from '@/lib/dashboardIntelligenceTooltips';
import { sanitizeDashboardDisplayText } from '@/lib/dashboardDisplayCopy';
import type { HabitProgressPayload } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

type Props = {
  data: HabitProgressPayload;
};

export function DashboardHabitProgressCard({ data }: Props) {
  const score =
    typeof data.consistencyScore === 'number' && Number.isFinite(data.consistencyScore)
      ? Math.max(0, Math.min(100, Math.round(data.consistencyScore)))
      : null;

  const streakLabel =
    typeof data.currentStreakDays === 'number' && Number.isFinite(data.currentStreakDays)
      ? `${Math.max(0, Math.round(data.currentStreakDays))}-Day Streak 🔥`
      : null;

  const encouragementRaw = data.encouragement?.trim() ?? '';

  const weekDays =
    typeof data.activeDaysThisWeek === 'number' && Number.isFinite(data.activeDaysThisWeek)
      ? Math.max(0, Math.round(data.activeDaysThisWeek))
      : null;

  const monthDays =
    typeof data.activeDaysThisMonth === 'number' && Number.isFinite(data.activeDaysThisMonth)
      ? Math.max(0, Math.round(data.activeDaysThisMonth))
      : null;

  const longest =
    typeof data.longestStreakDays === 'number' && Number.isFinite(data.longestStreakDays)
      ? Math.max(0, Math.round(data.longestStreakDays))
      : null;

  const encouragement =
    weekDays != null && weekDays > 0
      ? `${weekDays} active days this week. Keep it going with consistent search activity.`
      : encouragementRaw;

  return (
    <section className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-3.5 shadow-[0_18px_44px_-30px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.05] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-medium tracking-wide text-white/38">Daily streak</p>
            <InfoHint text={TOOLTIP_DAILY_STREAK} buttonAriaLabel="About daily streak" />
          </div>
          {streakLabel ? (
            <p className="mt-2 text-[17px] font-semibold leading-snug text-white/92">{streakLabel}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px] text-white/55">
            {weekDays != null ? (
              <span>
                Active days this week: <span className="tabular-nums font-medium text-white/75">{weekDays}</span>
              </span>
            ) : null}
            {monthDays != null ? (
              <span>
                Active days this month: <span className="tabular-nums font-medium text-white/75">{monthDays}</span>
              </span>
            ) : null}
          </div>
          {longest != null ? (
            <p className="mt-2 text-[12px] text-white/42">
              Longest streak: <span className="tabular-nums text-white/55">{longest}</span> days
            </p>
          ) : null}
        </div>
      </div>

      {score != null ? (
        <div className="mt-5">
          <div className="flex items-center justify-between gap-3 text-[11px] font-medium text-white/38">
            <span>Activity score</span>
            <span className="tabular-nums text-white/55">{score}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00C9B1]/80 to-[#9CF5EA]/55"
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      ) : null}

      {encouragement ? (
        <p className={cn('mt-4 text-[13px] leading-relaxed text-white/65', score != null ? '' : 'mt-5')}>
          {sanitizeDashboardDisplayText(encouragement)}
        </p>
      ) : null}
    </section>
  );
}
