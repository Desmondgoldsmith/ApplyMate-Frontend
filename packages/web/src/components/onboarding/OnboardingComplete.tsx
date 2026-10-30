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
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { CareerKiteMark } from '@/components/brand/CareerKiteMark';
import { CVScoreCard } from '@/components/cv/CVScoreCard';
import { ChromeIcon } from '@/components/landing/ChromeIcon';
import { OnboardingReferralPrompt } from '@/components/onboarding/OnboardingReferralPrompt';
import { ForcedThemeScope } from '@/components/theme/ThemeScope';
import { Button } from '@/components/ui/Button';
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
      color: 'var(--ck-success-text)',
      line: 'Recruiters will find what they need quickly. A few tweaks will make it even sharper.',
    };
  if (score >= 60)
    return {
      label: 'Good foundation',
      color: 'var(--ck-accent-text)',
      line: 'Solid start. The fixes below will lift your score the most.',
    };
  return {
    label: 'Needs some work',
    color: 'var(--ck-warning-text)',
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

function ScoreRing({ score }: { score: number }) {
  const reducedMotion = useReducedMotion();
  const gradientId = `ck-score-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
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
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c8f74a" />
            <stop offset="1" stopColor="#17b26a" />
          </linearGradient>
        </defs>
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="var(--ck-bg-hover)"
          strokeWidth="10"
        />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{
            strokeDashoffset: dash,
            filter: 'drop-shadow(0 0 10px var(--ck-glow-a))',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="font-display text-[42px] font-bold leading-none tracking-[-0.03em] tabular-nums text-text-primary">
          {rounded}
        </motion.span>
        <span className="mt-1 text-[12px] text-text-tertiary">out of 100</span>
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
    'group flex w-full items-center gap-3.5 rounded-2xl border border-border-subtle bg-bg-surface px-4 py-3.5 text-left shadow-raised transition-colors duration-150 hover:border-accent-border hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus';
  const inner = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent-text">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-text-primary">
          {title}
        </span>
        <span className="block text-[13px] text-text-secondary">{body}</span>
      </span>
      <ArrowRight
        className="h-4 w-4 shrink-0 text-text-tertiary transition-all group-hover:translate-x-0.5 group-hover:text-accent-text"
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
        colors: ['#b9f542', '#d6ff5e', '#17b26a', '#3ad68a', '#ffffff'],
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
      <motion.span
        initial={reducedMotion ? false : { opacity: 0, y: 24, rotate: -8 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="text-text-primary"
      >
        <CareerKiteMark size={64} variant="full" />
      </motion.span>
      <p className="mt-4 text-[14px] font-semibold text-accent-text">
        {hasCv ? 'Your CV is ready' : 'Your workspace is ready'}
      </p>
      <h1 className="mt-5 font-display text-[32px] font-bold leading-[1.08] tracking-[-0.03em] text-text-primary sm:text-[40px]">
        {title}
      </h1>
      <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-relaxed text-text-secondary">
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
          className="mt-8 w-full overflow-hidden rounded-3xl border border-border-subtle bg-bg-surface text-left shadow-overlay"
        >
          <div className="flex flex-col items-center gap-5 p-6 sm:flex-row sm:items-center sm:gap-6">
            <ScoreRing score={score} />
            <div className="min-w-0 text-center sm:text-left">
              <p className="text-[13px] font-semibold text-text-secondary">
                CV score
              </p>
              <p
                className="mt-0.5 font-display text-[24px] font-bold tracking-[-0.02em]"
                style={{ color: band.color }}
              >
                {band.label}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-text-secondary">
                {band.line}
              </p>
              {templateLabel ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-sunken px-2.5 py-1 text-[12px] font-medium text-text-secondary">
                  <Sparkles className="h-3 w-3 text-accent-text" aria-hidden />
                  {templateLabel} design
                </p>
              ) : null}
            </div>
          </div>

          {fixes.length > 0 ? (
            <div className="border-t border-border-subtle px-6 py-5">
              <p className="text-[13px] font-semibold text-text-primary">
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
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-[11px] font-bold text-accent-text">
                      {i + 1}
                    </span>
                    <span className="min-w-0 text-[13px] leading-relaxed text-text-secondary">
                      {f.text}
                      {f.section ? (
                        <span className="ml-2 inline-block rounded-full bg-bg-sunken px-2 py-px align-middle text-[11px] font-medium capitalize text-text-secondary">
                          {f.section}
                        </span>
                      ) : null}
                    </span>
                  </motion.li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-expanded={showDetails}
              className="flex w-full items-center justify-between px-6 py-3.5 text-[13px] font-medium text-text-secondary transition hover:text-text-primary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-border-focus"
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
              <ForcedThemeScope theme="dark">
                <div className="mx-4 mb-5 rounded-2xl bg-[#0e110f] p-1">
                  <CVScoreCard
                    mode="compact"
                    hideJobMatch
                    score={score}
                    breakdown={finalScore.breakdown}
                    scorePayload={finalScore}
                    improvementsCount={finalScore.improvements?.length}
                  />
                </div>
              </ForcedThemeScope>
            ) : null}
          </div>
        </motion.section>
      ) : null}

      {hasCv && score == null ? (
        <p className="mt-8 flex items-center gap-2 text-[14px] text-text-secondary">
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent-solid" />
          Your score is still being calculated. It will appear on your
          dashboard.
        </p>
      ) : null}

      <div className="mt-8 w-full max-w-[420px]">
        <Button
          type="button"
          variant="accent"
          fullWidth
          disabled={!accessToken}
          onClick={() => router.push('/dashboard')}
          className="h-[52px] text-[16px]"
        >
          Go to my dashboard
        </Button>
      </div>

      <div className="mt-8 w-full text-left">
        <p className="mb-3 text-center text-[14px] font-semibold text-text-secondary">
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
