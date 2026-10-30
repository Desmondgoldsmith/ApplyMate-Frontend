'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  FileUp,
  PenLine,
  Search,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CVScoreCard } from '@/components/cv/CVScoreCard';
import { ChromeIcon } from '@/components/landing/ChromeIcon';
import { OnboardingReferralPrompt } from '@/components/onboarding/OnboardingReferralPrompt';
import { api, type CVImprovementItem, type CVScorePayload } from '@/lib/api';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';
import { todayPlanQueryKey } from '@/lib/today-plan';
import { cn } from '@/lib/utils';

const EXTENSION_URL =
  process.env.NEXT_PUBLIC_CHROME_EXTENSION_URL?.trim() || '';

type CompletionSource = 'skip' | 'upload' | 'chat' | 'paste' | 'manual';

function scoreBand(score: number): {
  label: string;
  color: string;
  line: string;
} {
  if (score >= 80)
    return {
      label: 'Strong CV',
      color: '#22C55E',
      line: 'Recruiters will find what they need quickly. A few tweaks will make it even sharper.',
    };
  if (score >= 60)
    return {
      label: 'Good foundation',
      color: '#00C9B1',
      line: 'Solid start. The fixes below will lift your score the most.',
    };
  return {
    label: 'Needs some work',
    color: '#F59E0B',
    line: "Don't worry, most of this is quick to fix. Start with the items below.",
  };
}

const SEVERITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

function topFixes(items: CVImprovementItem[] | undefined, limit = 3) {
  const seen = new Set<string>();
  return (items ?? [])
    .filter((i) => !i.status || i.status === 'pending')
    .map((i) => ({
      text: (i.message ?? i.issue ?? i.suggestion ?? '').trim(),
      section: (i.section ?? '').trim(),
      rank: i.priority ?? SEVERITY_RANK[i.severity ?? ''] ?? 3,
    }))
    .filter((i) => {
      const key = i.text.toLowerCase();
      if (!i.text || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const reducedMotion = useReducedMotion();
  const value = useMotionValue(reducedMotion ? score : 0);
  const rounded = useTransform(value, (v) => Math.round(v));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dash = useTransform(value, (v) => circumference * (1 - v / 100));

  useEffect(() => {
    if (reducedMotion) {
      value.set(score);
      return;
    }
    const controls = animate(value, score, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [reducedMotion, score, value]);

  return (
    <div className="relative h-[136px] w-[136px] shrink-0">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="10"
        />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{
            strokeDashoffset: dash,
            filter: `drop-shadow(0 0 10px ${color}66)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="text-[38px] font-extrabold leading-none tabular-nums text-white">
          {rounded}
        </motion.span>
        <span className="mt-1 text-[12px] text-white/45">out of 100</span>
      </div>
    </div>
  );
}

function NextStep({
  icon,
  title,
  body,
  href,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  href?: string;
  onClick?: () => void;
}) {
  const className =
    'group flex w-full items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5 text-left transition-colors duration-150 hover:border-[rgba(0,201,177,0.35)] hover:bg-[rgba(0,201,177,0.05)]';
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,201,177,0.12)] text-[#00C9B1]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-white">
          {title}
        </span>
        <span className="block text-[12px] text-white/50">{body}</span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-white/30 transition-all group-hover:translate-x-0.5 group-hover:text-[#00C9B1]"
        aria-hidden
      />
    </>
  );
  if (href) {
    const external = href.startsWith('http');
    return (
      <Link
        href={href}
        className={className}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export function OnboardingComplete({
  firstName,
  finalScore,
  profileId,
  completionSource,
  templateLabel,
  accessToken,
  onboardingSaved,
  initialReferral,
  onOpenResumeEditor,
}: {
  firstName: string;
  finalScore: CVScorePayload | null;
  profileId: string | null;
  completionSource: CompletionSource;
  templateLabel: string | null;
  accessToken: string | null;
  /** True once onboarding is marked complete on the server (safe to warm dashboard data). */
  onboardingSaved: boolean;
  initialReferral?: string;
  onOpenResumeEditor: (
    profileId: string | null | undefined,
  ) => void | Promise<void>;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();
  const [showDetails, setShowDetails] = useState(false);
  const firedConfetti = useRef(false);

  const score =
    typeof finalScore?.score === 'number' && Number.isFinite(finalScore.score)
      ? Math.round(finalScore.score)
      : null;
  const band = score != null ? scoreBand(score) : null;

  /** Fixes come from the detailed score, which can finish a few seconds after this screen opens. */
  const suggestions = useQuery({
    queryKey: cvSuggestionsQueryKey(profileId),
    queryFn: () => api.cv.getSuggestions(profileId ?? undefined, false),
    enabled: Boolean(accessToken && profileId) && completionSource !== 'skip',
    staleTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const empty = !query.state.data?.improvements?.length;
      return empty && query.state.dataUpdateCount < 6 ? 3_000 : false;
    },
  });
  const fixes = useMemo(
    () =>
      topFixes(
        finalScore?.improvements?.length
          ? finalScore.improvements
          : suggestions.data?.improvements,
      ),
    [finalScore?.improvements, suggestions.data?.improvements],
  );

  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);

  useEffect(() => {
    if (!onboardingSaved || !accessToken) return;
    let timezone = 'UTC';
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      /* keep UTC */
    }
    const cvProfileId = profileId?.trim() || undefined;
    void queryClient.prefetchQuery({
      queryKey: todayPlanQueryKey({
        cvProfileId,
        timezone,
        includeHiddenDashboardCards: false,
      }),
      queryFn: () =>
        api.dashboard.getTodayPlan({
          cvProfileId,
          timezone,
          includeHiddenDashboardCards: false,
        }),
      staleTime: 60_000,
    });
  }, [accessToken, onboardingSaved, profileId, queryClient]);

  useEffect(() => {
    if (reducedMotion || firedConfetti.current || completionSource === 'skip')
      return;
    firedConfetti.current = true;
    const id = window.setTimeout(() => {
      void confetti({
        particleCount: 90,
        spread: 75,
        startVelocity: 38,
        origin: { y: 0.3 },
        colors: ['#00C9B1', '#5EEAD4', '#FFFFFF', '#F59E0B'],
        disableForReducedMotion: true,
      });
    }, 900);
    return () => window.clearTimeout(id);
  }, [completionSource, reducedMotion]);

  const hasCv = completionSource !== 'skip';
  const title = firstName ? `You're all set, ${firstName}.` : "You're all set.";

  return (
    <motion.div
      key="s3"
      initial={reducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto flex w-full max-w-[600px] flex-col items-center text-center"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00C9B1]">
        {hasCv ? 'Your CV is ready' : 'Your workspace is ready'}
      </p>
      <h1 className="mt-3 text-[28px] font-extrabold leading-tight text-white sm:text-[34px]">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-relaxed text-white/55">
        {hasCv
          ? "Here's how your CV scores today, and what to do next."
          : 'Add your CV whenever you like. Everything else is ready to explore.'}
      </p>

      {hasCv && score != null && band ? (
        <motion.section
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: reducedMotion ? 0 : 0.15,
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mt-8 w-full overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0C0F0F]/90 text-left shadow-[0_24px_70px_rgba(0,0,0,0.4)]"
        >
          <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center sm:gap-6">
            <ScoreRing score={score} color={band.color} />
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-white/45">
                CV score
              </p>
              <p
                className="mt-1 text-[22px] font-bold"
                style={{ color: band.color }}
              >
                {band.label}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">
                {band.line}
              </p>
              {templateLabel ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] px-2.5 py-1 text-[12px] text-white/55">
                  <Sparkles className="h-3 w-3 text-[#00C9B1]" aria-hidden />
                  {templateLabel} design
                </p>
              ) : null}
            </div>
          </div>

          {fixes.length > 0 ? (
            <div className="border-t border-white/[0.06] px-6 py-5">
              <p className="text-[13px] font-semibold text-white">
                Top {fixes.length === 1 ? 'fix' : `${fixes.length} fixes`} to
                raise your score
              </p>
              <ol className="mt-3 space-y-2.5">
                {fixes.map((f, i) => (
                  <motion.li
                    key={f.text}
                    initial={reducedMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: reducedMotion ? 0 : 0.6 + i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,177,0.15)] text-[11px] font-bold text-[#00C9B1]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 text-[13px] leading-relaxed text-white/75">
                      {f.text}
                      {f.section ? (
                        <span className="ml-1.5 text-[11px] capitalize text-white/35">
                          · {f.section}
                        </span>
                      ) : null}
                    </span>
                  </motion.li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              className="flex w-full items-center justify-between px-6 py-3.5 text-[13px] text-white/55 transition hover:text-white"
            >
              How is this score calculated?
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  showDetails && 'rotate-180',
                )}
                aria-hidden
              />
            </button>
            {showDetails && finalScore ? (
              <div className="px-4 pb-5">
                <CVScoreCard
                  mode="compact"
                  hideJobMatch
                  score={score}
                  breakdown={finalScore.breakdown}
                  scorePayload={finalScore}
                  improvementsCount={finalScore.improvements?.length}
                />
              </div>
            ) : null}
          </div>
        </motion.section>
      ) : null}

      {hasCv && score == null ? (
        <p className="mt-8 flex items-center gap-2 text-[14px] text-white/50">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#00C9B1]" />
          Your score is still being calculated. It will appear on your
          dashboard.
        </p>
      ) : null}

      <div className="mt-8 w-full max-w-[420px]">
        <motion.button
          type="button"
          disabled={!accessToken}
          onClick={() => router.push('/dashboard')}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          className="group inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#00C9B1] px-8 text-[15px] font-semibold text-[#080A0A] shadow-[0_10px_34px_rgba(0,201,177,0.3)] transition-shadow hover:shadow-[0_12px_40px_rgba(0,201,177,0.45)] disabled:opacity-50"
        >
          Go to my dashboard
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2.5}
          />
        </motion.button>
      </div>

      <div className="mt-8 w-full text-left">
        <p className="mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.1em] text-white/40">
          Or jump straight in
        </p>
        <div className="space-y-2.5">
          <NextStep
            icon={<Search className="h-[18px] w-[18px]" />}
            title="Analyze your first job"
            body="Paste a job description and see your match score in about a minute."
            href="/dashboard/jobs/analyze?clean=1"
          />
          {hasCv && profileId ? (
            <NextStep
              icon={<PenLine className="h-[18px] w-[18px]" />}
              title="Polish your CV"
              body="Apply the suggested fixes in the editor."
              onClick={() => void onOpenResumeEditor(profileId)}
            />
          ) : (
            <NextStep
              icon={<FileUp className="h-[18px] w-[18px]" />}
              title="Add your CV"
              body="Upload it anytime to get your score and job matches."
              href="/dashboard/cv"
            />
          )}
          {EXTENSION_URL ? (
            <NextStep
              icon={<ChromeIcon className="h-[18px] w-[18px]" />}
              title="Get the Chrome extension"
              body="See your match score on any job board and fill applications faster."
              href={EXTENSION_URL}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-6 w-full">
        <OnboardingReferralPrompt initialSource={initialReferral} />
      </div>
    </motion.div>
  );
}
