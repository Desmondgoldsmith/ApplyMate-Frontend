'use client';

import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  Check,
  FileText,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import type {
  HomeAction,
  NextStep,
  PipelineCounts,
  SetupStep,
} from '@/components/dashboard/home/homeModel';
import { ROUTES } from '@/components/dashboard/home/homeModel';
import { Button } from '@/components/ui/Button';
import { openWalkthroughVideo } from '@/lib/welcomeEvents';
import { cn } from '@/lib/utils';

export function Card({
  className,
  children,
  tour,
}: {
  className?: string;
  children: ReactNode;
  tour?: string;
}) {
  return (
    <section
      data-tour={tour}
      className={cn(
        'rounded-3xl border border-border-subtle bg-bg-surface p-5 shadow-raised sm:p-6',
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="font-display text-[18px] font-bold tracking-[-0.02em] text-text-primary">
        {children}
      </h2>
      {action}
    </div>
  );
}

function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-[44px] items-center gap-1 rounded-lg text-[14px] font-semibold text-accent-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    >
      {children}
    </Link>
  );
}

/** The one thing to do next. The visual hero of Home. */
export function NextStepCard({ step }: { step: NextStep }) {
  return (
    <section
      data-tour="home-next-step"
      className="relative overflow-hidden rounded-3xl border border-accent-border bg-accent-subtle p-6 shadow-raised sm:p-8"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-60 blur-2xl"
        style={{
          background:
            'radial-gradient(circle, var(--ck-glow-a), transparent 70%)',
        }}
        aria-hidden
      />
      <p className="relative flex items-center gap-2 text-[14px] font-semibold text-accent-text">
        <Sparkles className="h-4 w-4" aria-hidden />
        Your next step
      </p>
      <h2 className="relative mt-2 max-w-[24ch] font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-text-primary sm:text-[34px]">
        {step.title}
      </h2>
      {step.detail ? (
        <p className="relative mt-3 max-w-[58ch] text-[15px] leading-relaxed text-text-secondary">
          {step.detail}
        </p>
      ) : null}
      <div className="relative mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Button asChild variant="accent" className="px-7">
          <Link href={step.href}>
            {step.ctaLabel}
            <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
          </Link>
        </Button>
        {step.secondary ? (
          <TextLink href={step.secondary.href}>{step.secondary.label}</TextLink>
        ) : null}
      </div>
    </section>
  );
}

export function SetupCard({
  steps,
  showVideo,
  showVideoHint,
}: {
  steps: SetupStep[];
  showVideo: boolean;
  /** Development hint telling the owner where the walkthrough video goes. */
  showVideoHint: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <Card tour="home-setup">
      <CardTitle
        action={
          <span className="rounded-full bg-bg-sunken px-2.5 py-1 text-[13px] font-semibold text-text-secondary">
            {done} of {steps.length}
          </span>
        }
      >
        Get set up
      </CardTitle>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-bg-hover"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Setup progress"
      >
        <motion.div
          className="bg-brand-gradient h-full rounded-full"
          initial={reducedMotion ? false : { width: 0 }}
          animate={{ width: `${Math.max(6, pct)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map((s) => (
          <li key={s.id}>
            {s.done ? (
              <span className="flex min-h-[44px] items-center gap-3 text-[14px] text-text-secondary">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-solid text-text-on-accent">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                </span>
                <span className="line-through decoration-border-strong">
                  {s.label}
                </span>
                <span className="sr-only">(done)</span>
              </span>
            ) : (
              <Link
                href={s.href}
                className="group -mx-2 flex min-h-[44px] items-center gap-3 rounded-xl px-2 text-[14px] font-semibold text-text-primary transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-border-focus"
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-full border-2 border-border-strong"
                  aria-hidden
                />
                <span className="flex-1">{s.label}</span>
                <ArrowRight
                  className="h-4 w-4 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
                  aria-hidden
                />
              </Link>
            )}
          </li>
        ))}
      </ol>
      {showVideo ? (
        <button
          type="button"
          onClick={openWalkthroughVideo}
          data-tour="home-video"
          className="group mt-4 flex w-full items-center gap-3 rounded-2xl border border-border-default bg-bg-sunken p-3 text-left transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
        >
          <span className="bg-brand-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-text-on-accent">
            <PlayCircle className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-text-primary">
              Watch the 2-minute walkthrough
            </span>
            <span className="block text-[13px] text-text-secondary">
              See everything CareerKite can do for you.
            </span>
          </span>
        </button>
      ) : showVideoHint ? (
        <p className="mt-4 rounded-2xl border border-dashed border-border-strong p-3 text-[13px] text-text-secondary">
          Walkthrough video goes here. Set{' '}
          <code className="rounded bg-bg-sunken px-1 py-0.5 text-[12px] text-text-primary">
            NEXT_PUBLIC_WALKTHROUGH_VIDEO_URL
          </code>{' '}
          to a YouTube link to show it. Only visible in development.
        </p>
      ) : null}
    </Card>
  );
}

export function TodayCard({ actions }: { actions: HomeAction[] }) {
  return (
    <Card tour="home-today">
      <CardTitle>Today</CardTitle>
      {actions.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-text-secondary">
          Nothing urgent right now. When you save or apply for jobs, reminders
          and follow-ups will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {actions.map((a) => (
            <li key={a.id}>
              <Link
                href={a.href}
                className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-3.5 transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-border-focus"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-text-primary">
                    {a.title}
                  </span>
                  {a.detail ? (
                    <span className="mt-0.5 line-clamp-2 block text-[13px] text-text-secondary">
                      {a.detail}
                    </span>
                  ) : null}
                </span>
                <span className="hidden shrink-0 text-[13px] font-semibold text-accent-text sm:inline">
                  {a.ctaLabel}
                </span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-16 w-16 shrink-0" aria-hidden>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ck-home-score" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c8f74a" />
            <stop offset="1" stopColor="#17b26a" />
          </linearGradient>
        </defs>
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--ck-bg-hover)"
          strokeWidth="6"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="url(#ck-home-score)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-[18px] font-bold text-text-primary">
        {Math.round(pct)}
      </span>
    </div>
  );
}

function scoreWords(score: number): string {
  if (score >= 80) return 'Strong CV. A few tweaks will make it sharper.';
  if (score >= 60) return 'Good start. The suggested fixes will lift it most.';
  return 'Needs some work. Start with the top fix.';
}

export function CvCard({
  name,
  score,
  topFix,
  editHref,
}: {
  name: string | null;
  score: number | null;
  topFix: string | null;
  editHref: string;
}) {
  return (
    <Card tour="home-cv">
      <CardTitle action={<TextLink href={editHref}>Open</TextLink>}>
        Your CV
      </CardTitle>
      {name ? (
        <>
          <div className="flex items-center gap-4">
            {score != null ? (
              <ScoreBadge score={score} />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent-subtle text-accent-text">
                <FileText className="h-7 w-7" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-text-primary">
                {name}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-text-secondary">
                {score != null
                  ? `Score ${Math.round(score)} of 100. ${scoreWords(score)}`
                  : "We're still scoring it. Check back in a minute."}
              </p>
            </div>
          </div>
          {topFix ? (
            <div className="mt-4 rounded-2xl bg-bg-sunken p-3.5">
              <p className="text-[12px] font-semibold text-text-secondary">
                Top fix
              </p>
              <p className="mt-0.5 text-[14px] text-text-primary">{topFix}</p>
            </div>
          ) : null}
          <Button asChild variant="outline" fullWidth className="mt-4">
            <Link href={editHref}>Improve my CV</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed text-text-secondary">
            You haven&apos;t added a CV yet. Add one to get your score and
            personalised job matches.
          </p>
          <Button asChild variant="accent" fullWidth className="mt-4">
            <Link href={ROUTES.cv}>Add my CV</Link>
          </Button>
        </>
      )}
    </Card>
  );
}

export function ApplicationsCard({ counts }: { counts: PipelineCounts }) {
  const total =
    counts.saved + counts.applied + counts.interviewing + counts.offers;
  const stages: { label: string; value: number }[] = [
    { label: 'Saved', value: counts.saved },
    { label: 'Applied', value: counts.applied },
    { label: 'Interviews', value: counts.interviewing },
    { label: 'Offers', value: counts.offers },
  ];
  return (
    <Card tour="home-applications">
      <CardTitle
        action={
          total > 0 ? (
            <TextLink href={ROUTES.applications}>View all</TextLink>
          ) : undefined
        }
      >
        Your applications
      </CardTitle>
      {total === 0 ? (
        <>
          <p className="text-[15px] leading-relaxed text-text-secondary">
            Nothing tracked yet. Save jobs you like, then move them along as you
            apply, interview and get offers.
          </p>
          <Button asChild variant="outline" fullWidth className="mt-4">
            <Link href={ROUTES.findJobs}>Find jobs to save</Link>
          </Button>
        </>
      ) : (
        <dl className="grid grid-cols-4 gap-2">
          {stages.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl bg-bg-sunken px-2 py-3 text-center"
            >
              <dt className="text-[12px] font-medium text-text-secondary">
                {s.label}
              </dt>
              <dd className="mt-0.5 font-display text-[22px] font-bold text-text-primary">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

export function PracticeCard() {
  return (
    <Card tour="home-practice">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent-text">
          <BrainCircuit className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[18px] font-bold tracking-[-0.02em] text-text-primary">
            Practise an interview
          </h2>
          <p className="mt-1 text-[14px] leading-relaxed text-text-secondary">
            Answer real questions for your target role and get feedback on every
            answer.
          </p>
          <TextLink href={ROUTES.interview}>
            Start practising
            <ArrowRight className="h-4 w-4" aria-hidden />
          </TextLink>
        </div>
      </div>
    </Card>
  );
}
