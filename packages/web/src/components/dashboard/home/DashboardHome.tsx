'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useSyncExternalStore } from 'react';

import {
  ApplicationsCard,
  CvCard,
  NextStepCard,
  PracticeCard,
  SetupCard,
  TodayCard,
} from '@/components/dashboard/home/HomeCards';
import {
  buildSetupSteps,
  buildTodayActions,
  chooseNextStep,
  countPipeline,
  greetingFor,
  pickDefaultProfile,
  ROUTES,
  trackedCount,
} from '@/components/dashboard/home/homeModel';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useCvProfileRowsDisplay } from '@/hooks/useCvProfileRowsDisplay';
import { useDashboardSeen } from '@/hooks/useDashboardSeen';
import { useDashboardTodayPlanQuery } from '@/hooks/useDashboardTodayPlanQuery';
import { useJobHistory } from '@/hooks/useJobHistory';
import type { JobHistoryItem } from '@/lib/api';
import { getDisplayName } from '@/lib/display-name';
import { WALKTHROUGH_VIDEO_ID } from '@/lib/walkthroughVideo';
import { useAuthStore } from '@/store/useAuthStore';

const subscribeNever = () => () => {};

/** Same key and cadence as the previous overview, so "since your last visit" stays accurate. */
const LAST_SEEN_KEY = 'applymate:dashboard:last-seen-marked-at';
const LAST_SEEN_MIN_GAP_MS = 6 * 60 * 60 * 1000;

function HomeSkeleton() {
  return (
    <div
      className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]"
      aria-busy="true"
      aria-label="Loading your dashboard"
    >
      <div className="space-y-5">
        <div className="h-[230px] animate-pulse rounded-3xl border border-border-subtle bg-bg-surface" />
        <div className="h-[200px] animate-pulse rounded-3xl border border-border-subtle bg-bg-surface" />
      </div>
      <div className="space-y-5">
        <div className="h-[260px] animate-pulse rounded-3xl border border-border-subtle bg-bg-surface" />
        <div className="h-[180px] animate-pulse rounded-3xl border border-border-subtle bg-bg-surface" />
      </div>
    </div>
  );
}

/** Home: one clear next step, setup progress, today's to-dos and a glance at CV and applications. */
export function DashboardHome() {
  const reducedMotion = useReducedMotion();
  const { data: me } = useCurrentUser();
  const storeUser = useAuthStore((s) => s.user);
  const user = me ?? storeUser ?? undefined;
  const features = user?.selectedFeatures ?? ['cv'];

  const { displayRows, isBootstrapping } = useCvProfileRowsDisplay();
  const analytics = useAnalytics();
  const history = useJobHistory();
  const todayPlan = useDashboardTodayPlanQuery();

  // Local time only exists in the browser; the server renders a neutral greeting.
  const greeting = useSyncExternalStore(
    subscribeNever,
    () => greetingFor(new Date()),
    () => 'Welcome back',
  );

  const markSeen = useDashboardSeen();
  const markSeenMutate = markSeen.mutate;
  const planReady = Boolean(todayPlan.data);
  useEffect(() => {
    if (!planReady) return;
    const now = Date.now();
    let last = 0;
    try {
      last = Number(window.localStorage.getItem(LAST_SEEN_KEY) ?? 0);
    } catch {
      last = 0;
    }
    if (Number.isFinite(last) && now - last < LAST_SEEN_MIN_GAP_MS) return;
    markSeenMutate(undefined, {
      onSuccess: () => {
        try {
          window.localStorage.setItem(LAST_SEEN_KEY, String(now));
        } catch {
          /* storage disabled: the server simply gets marked again later */
        }
      },
    });
  }, [planReady, markSeenMutate]);

  const profile = pickDefaultProfile(displayRows);
  const hasCv = Boolean(profile);
  const historyItems = useMemo(
    (): JobHistoryItem[] => (Array.isArray(history.data) ? history.data : []),
    [history.data],
  );
  const pipeline = useMemo(() => countPipeline(historyItems), [historyItems]);
  const jobsChecked = Math.max(
    analytics.data?.jobsAnalyzed ?? 0,
    historyItems.filter((j) => j.matchScore != null).length,
  );
  const plan = todayPlan.data ?? null;
  const today = useMemo(() => buildTodayActions(plan), [plan]);
  const nextStep = useMemo(
    () => chooseNextStep({ hasCv, jobsChecked, today, plan }),
    [hasCv, jobsChecked, today, plan],
  );
  // The hero already shows the first to-do; don't repeat it in the list.
  const todayRest = today.filter((a) => `next-${a.id}` !== nextStep.id);
  const setup = buildSetupSteps({
    hasCv,
    jobsChecked,
    tracked: trackedCount(pipeline),
  });
  const setupDone = setup.every((s) => s.done);

  // Only greet by name when the user gave one; never guess it from the email.
  const firstName = user?.name?.trim()
    ? (getDisplayName(user).split(/\s+/)[0] ?? '')
    : '';
  const showName = Boolean(firstName);
  const loading = isBootstrapping || (analytics.isPending && history.isPending);

  const topFix = plan?.cvClinicNudge?.title?.trim() || null;
  const editHref = profile
    ? `${ROUTES.cv}?profileId=${encodeURIComponent(profile.id)}`
    : ROUTES.cv;

  const fade = (i: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.4,
            delay: 0.05 * i,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        };

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <header className="mb-6">
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.03em] text-text-primary sm:text-[32px]">
          {greeting}
          {showName ? `, ${firstName}` : ''}.
        </h1>
        <p className="mt-1 text-[15px] text-text-secondary">
          {!hasCv
            ? "Let's get your job search set up. It only takes a few minutes."
            : todayRest.length + (nextStep.id.startsWith('next-') ? 1 : 0) > 0
              ? 'Here is what needs your attention today.'
              : 'You are up to date. Here is a good next move.'}
        </p>
      </header>

      {loading ? (
        <HomeSkeleton />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
          <div className="space-y-5">
            <motion.div {...fade(0)}>
              <NextStepCard step={nextStep} />
            </motion.div>
            {!setupDone ? (
              <motion.div {...fade(1)} className="lg:hidden">
                <SetupCard
                  steps={setup}
                  showVideo={Boolean(WALKTHROUGH_VIDEO_ID)}
                  showVideoHint={process.env.NODE_ENV !== 'production'}
                />
              </motion.div>
            ) : null}
            <motion.div {...fade(2)}>
              <TodayCard actions={todayRest} />
            </motion.div>
          </div>

          <div className="space-y-5">
            {!setupDone ? (
              <motion.div {...fade(1)} className="hidden lg:block">
                <SetupCard
                  steps={setup}
                  showVideo={Boolean(WALKTHROUGH_VIDEO_ID)}
                  showVideoHint={process.env.NODE_ENV !== 'production'}
                />
              </motion.div>
            ) : null}
            <motion.div {...fade(3)}>
              <CvCard
                name={profile?.name ?? null}
                score={profile?.score ?? null}
                topFix={topFix}
                editHref={editHref}
              />
            </motion.div>
            {features.includes('jobs') ? (
              <motion.div {...fade(4)}>
                <ApplicationsCard counts={pipeline} />
              </motion.div>
            ) : null}
            {features.includes('interviews') ? (
              <motion.div {...fade(5)}>
                <PracticeCard />
              </motion.div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
