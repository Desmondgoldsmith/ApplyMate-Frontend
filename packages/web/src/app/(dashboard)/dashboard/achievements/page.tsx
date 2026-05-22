'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { AchievementCelebrationPanel } from '@/components/achievements/AchievementCelebrationPanel';
import { DashboardCareerAchievementsSection } from '@/components/dashboard/DashboardCareerAchievementsSection';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { ListPageShimmer } from '@/components/ui/ListPageShimmer';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useTodayPlan } from '@/hooks/useTodayPlan';
import { dashboardEmptyStateFor, normalizedSectionTitle } from '@/lib/today-plan';

export default function DashboardAchievementsPage() {
  const { displayRows } = useCvProfileRowsDisplay();
  const defaultProfile = useMemo(
    () => displayRows.find((p) => p.isDefault) ?? displayRows[0] ?? null,
    [displayRows],
  );
  const browserTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, []);

  const todayPlan = useTodayPlan({
    cvProfileId: defaultProfile?.id ?? null,
    timezone: browserTz,
  });

  const plan = todayPlan.data;
  const heading =
    normalizedSectionTitle(plan, 'career_achievements', '')?.trim() ||
    normalizedSectionTitle(plan, 'achievements', '')?.trim() ||
    'Achievements';
  const digestVersion = plan?.digestVersion?.trim() ?? 'achievements-page';
  const busy = todayPlan.isLoading && !plan;

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Achievements</h1>
        <p className="mt-1 max-w-2xl text-sm text-white/45">
          Celebrate your wins, track what&apos;s almost unlocked, and share your momentum.
        </p>
      </div>

      {busy ? (
        <ListPageShimmer cardCount={4} tableRows={0} />
      ) : todayPlan.isError ? (
        <GlowCard contentClassName="p-6">
          <p className="text-sm text-rose-200">Could not load achievements.</p>
          <Button className="mt-4" variant="ghost" onClick={() => void todayPlan.refetch()}>
            Retry
          </Button>
        </GlowCard>
      ) : (
        <>
          <AchievementCelebrationPanel
            career={plan?.careerAchievements ?? null}
            achievements={plan?.achievements ?? null}
          />
          <DashboardCareerAchievementsSection
            digestVersion={digestVersion}
            career={plan?.careerAchievements ?? null}
            achievements={plan?.achievements ?? null}
            heading={heading}
            phase15Empty={dashboardEmptyStateFor(plan ?? null, 'achievements')}
            variant="page"
            maxWins={12}
            maxAlmost={8}
          />
        </>
      )}

      <p className="text-center text-[12px] text-white/35">
        Accepted job offers live on{' '}
        <Link href="/dashboard/career-achievements" className="text-[#00C9B1] hover:underline">
          Career Achievements
        </Link>
        .
      </p>
    </div>
  );
}
