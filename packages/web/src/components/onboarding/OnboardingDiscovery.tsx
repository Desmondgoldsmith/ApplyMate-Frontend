'use client';

import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  CalendarClock,
  Check,
  Compass,
  FileCheck2,
  MessagesSquare,
  Plus,
  Rocket,
  Target,
  X,
} from 'lucide-react';

import { CareerKiteMark } from '@/components/brand/CareerKiteMark';
import { KiteHero } from '@/components/brand/KiteHero';
import { OnboardingBackLink } from '@/components/onboarding/OnboardingBackLink';
import {
  ONBOARDING_SUBTITLE_CLASS,
  ONBOARDING_TITLE_CLASS,
} from '@/components/onboarding/onboardingLayout';
import { ThemeChoiceCards } from '@/components/theme/ThemeChoiceCards';
import { Button } from '@/components/ui/Button';
import type { JobSearchUrgency } from '@/lib/onboardingWizardStorage';
import { cn } from '@/lib/utils';

/** Discovery screens in order: welcome, look, timeline, target roles. */
export const DISCOVERY_STEPS = [0, 1, 2, 3] as const;
export type DiscoveryStep = (typeof DISCOVERY_STEPS)[number];

/** Clamps saved state (older builds also stored a retired step 4). */
export function normalizeDiscoveryStep(raw: number): DiscoveryStep {
  if (raw >= 3) return 3;
  if (raw >= 2) return 2;
  if (raw >= 1) return 1;
  return 0;
}

const SUGGESTED_ROLES = [
  'Software Engineer',
  'Product Manager',
  'Data Analyst',
  'UX Designer',
  'Project Manager',
  'Marketing Manager',
  'Business Analyst',
  'Sales Executive',
] as const;

const WELCOME_POINTS: ReadonlyArray<{
  Icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}> = [
  {
    Icon: FileCheck2,
    title: 'A CV score with clear fixes',
    body: 'See what recruiters notice and what to improve first.',
  },
  {
    Icon: Target,
    title: 'Jobs matched to your CV',
    body: 'Know your fit and skill gaps before you apply.',
  },
  {
    Icon: MessagesSquare,
    title: 'Interview practice for your roles',
    body: 'Rehearse with an AI interviewer that knows your CV.',
  },
];

const URGENCY_OPTIONS: ReadonlyArray<{
  value: JobSearchUrgency;
  Icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}> = [
  {
    value: 'asap',
    Icon: Rocket,
    title: 'As soon as possible',
    body: "I'm applying now or about to start.",
  },
  {
    value: 'few_months',
    Icon: CalendarClock,
    title: 'In the next few months',
    body: 'I want to be ready when the right role appears.',
  },
  {
    value: 'exploring',
    Icon: Compass,
    title: 'Just exploring',
    body: "I'm seeing what's out there for now.",
  },
];

function PrimaryCta({
  children,
  disabled,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <div className="mt-9 flex w-full justify-center">
      <Button
        type="button"
        variant="accent"
        disabled={disabled}
        onClick={() => void onClick()}
        className="w-full px-10 sm:w-auto sm:min-w-[240px]"
      >
        {children}
      </Button>
    </div>
  );
}

type OnboardingDiscoveryProps = {
  firstName: string;
  discoveryStep: DiscoveryStep;
  jobSearchUrgency: JobSearchUrgency | null;
  onSelectUrgency: (v: JobSearchUrgency) => void;
  targetRolesText: string;
  onTargetRolesChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void | Promise<void>;
  savePending: boolean;
};

function parseRolesFromText(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function OnboardingDiscovery({
  firstName,
  discoveryStep,
  jobSearchUrgency,
  onSelectUrgency,
  targetRolesText,
  onTargetRolesChange,
  onBack,
  onNext,
  savePending,
}: OnboardingDiscoveryProps) {
  const reducedMotion = useReducedMotion();
  const [roleInput, setRoleInput] = useState('');
  const urgencyTimerRef = useRef<number | null>(null);

  const greeting =
    firstName.trim().length > 0
      ? `Welcome, ${firstName.trim()}.`
      : 'Welcome to CareerKite.';

  const roleChips = useMemo(
    () => parseRolesFromText(targetRolesText),
    [targetRolesText],
  );
  const pendingRole = roleInput.trim();
  const rolesValid = roleChips.length >= 1 || pendingRole.length >= 2;

  const clearUrgencyTimer = useCallback(() => {
    if (urgencyTimerRef.current != null) {
      window.clearTimeout(urgencyTimerRef.current);
      urgencyTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearUrgencyTimer, [clearUrgencyTimer]);

  const handleUrgencyPick = (v: JobSearchUrgency) => {
    clearUrgencyTimer();
    onSelectUrgency(v);
    urgencyTimerRef.current = window.setTimeout(
      () => void onNext(),
      reducedMotion ? 0 : 320,
    );
  };

  const pushRoleChip = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const existing = parseRolesFromText(targetRolesText);
    if (existing.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setRoleInput('');
      return;
    }
    if (existing.length >= 10) return;
    onTargetRolesChange([...existing, t].join(', '));
    setRoleInput('');
  };

  const commitPendingRole = () => {
    if (pendingRole.length >= 2) pushRoleChip(pendingRole);
  };

  const removeRoleChip = (label: string) => {
    onTargetRolesChange(
      parseRolesFromText(targetRolesText)
        .filter((x) => x !== label)
        .join(', '),
    );
  };

  const onRolesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      pushRoleChip(roleInput.replace(/,$/, ''));
    }
  };

  const stepMotionProps = reducedMotion
    ? { initial: false, animate: { opacity: 1, x: 0 } }
    : {
        initial: { opacity: 0, x: 18 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -18 },
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
      };

  const suggestions = SUGGESTED_ROLES.filter(
    (r) => !roleChips.some((c) => c.toLowerCase() === r.toLowerCase()),
  );

  return (
    <div className="flex w-full flex-col items-center text-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={discoveryStep}
          {...stepMotionProps}
          className="flex w-full flex-col items-center"
        >
          {discoveryStep === 0 ? (
            <>
              <KiteHero className="-mt-6 mb-2 hidden h-[230px] w-full max-w-[420px] lg:block" />
              <CareerKiteMark
                size={72}
                variant="full"
                className="mb-5 text-text-primary lg:hidden"
              />
              <h1 className={ONBOARDING_TITLE_CLASS}>{greeting}</h1>
              <p className={ONBOARDING_SUBTITLE_CLASS}>
                Let&apos;s set up CareerKite around your job search. It takes
                about two minutes.
              </p>
              <ul className="mt-8 w-full max-w-[560px] space-y-2.5 text-left">
                {WELCOME_POINTS.map(({ Icon, title, body }, i) => (
                  <motion.li
                    key={title}
                    initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: reducedMotion ? 0 : 0.12 + i * 0.08,
                      duration: 0.35,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex items-center gap-4 rounded-2xl border border-border-subtle bg-bg-surface px-4 py-3.5 shadow-raised"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent-text">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold text-text-primary">
                        {title}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-text-secondary">
                        {body}
                      </span>
                    </span>
                  </motion.li>
                ))}
              </ul>
            </>
          ) : null}

          {discoveryStep === 1 ? (
            <>
              <OnboardingBackLink onClick={onBack} />
              <h1 className={ONBOARDING_TITLE_CLASS}>Pick your look</h1>
              <p className={ONBOARDING_SUBTITLE_CLASS}>
                Choose how CareerKite looks for you. It&apos;s saved to your
                account, and you can switch any time from the top of the screen.
              </p>
              <div className="mt-8 w-full">
                <ThemeChoiceCards />
              </div>
            </>
          ) : null}

          {discoveryStep === 2 ? (
            <>
              <OnboardingBackLink onClick={onBack} />
              <h1 className={ONBOARDING_TITLE_CLASS}>
                When do you want to start a new role?
              </h1>
              <p className={ONBOARDING_SUBTITLE_CLASS}>
                We&apos;ll pace reminders and suggestions to match. You can
                change this later.
              </p>
              <div
                className="mt-8 flex w-full max-w-[560px] flex-col gap-3"
                role="radiogroup"
                aria-label="When do you want to start a new role?"
              >
                {URGENCY_OPTIONS.map(({ value, Icon, title, body }) => (
                  <ChoiceCard
                    key={value}
                    Icon={Icon}
                    title={title}
                    body={body}
                    selected={jobSearchUrgency === value}
                    onClick={() => handleUrgencyPick(value)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {discoveryStep === 3 ? (
            <>
              <OnboardingBackLink onClick={onBack} />
              <h1 className={ONBOARDING_TITLE_CLASS}>
                What roles are you aiming for?
              </h1>
              <p className={ONBOARDING_SUBTITLE_CLASS}>
                Add one or more job titles. We use them to find matching jobs
                and tailor your suggestions.
              </p>
              <div className="mt-8 w-full max-w-[560px]">
                <label
                  htmlFor="onb-role-input"
                  className="mb-1.5 block text-left text-sm font-semibold text-text-primary"
                >
                  Job title
                </label>
                <div className="flex gap-2">
                  <input
                    id="onb-role-input"
                    type="text"
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    onKeyDown={onRolesKeyDown}
                    onBlur={() => {
                      if (pendingRole.length >= 2) commitPendingRole();
                    }}
                    placeholder="e.g. Frontend Developer"
                    autoComplete="off"
                    aria-describedby="onb-role-hint"
                    className="h-12 min-h-[48px] flex-1 rounded-xl border border-border-strong bg-bg-sunken px-4 text-left text-[15px] text-text-primary outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-text-tertiary focus:border-border-focus focus:bg-bg-surface focus:shadow-[0_0_0_3px_var(--ck-accent-subtle)]"
                  />
                  <button
                    type="button"
                    disabled={pendingRole.length < 2}
                    onClick={commitPendingRole}
                    className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-border-default bg-bg-surface px-4 text-[14px] font-semibold text-text-primary transition-colors enabled:hover:border-border-strong enabled:hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                    Add
                  </button>
                </div>
                <p
                  id="onb-role-hint"
                  className="mt-1.5 text-left text-[13px] text-text-tertiary"
                >
                  Press Enter to add each title.
                </p>
                <div className="mt-4 flex min-h-[32px] flex-wrap justify-center gap-2">
                  <AnimatePresence initial={false}>
                    {roleChips.map((chip) => (
                      <motion.span
                        key={chip}
                        layout={!reducedMotion}
                        initial={
                          reducedMotion ? false : { opacity: 0, scale: 0.85 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={
                          reducedMotion
                            ? undefined
                            : { opacity: 0, scale: 0.85 }
                        }
                        transition={{ duration: 0.18 }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-subtle py-1 pl-3 pr-1 text-[13px] font-semibold text-accent-text"
                      >
                        <Check
                          className="h-3.5 w-3.5"
                          strokeWidth={3}
                          aria-hidden
                        />
                        {chip}
                        <button
                          type="button"
                          aria-label={`Remove ${chip}`}
                          className="flex h-6 w-6 items-center justify-center rounded-full transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-border-focus"
                          onClick={() => removeRoleChip(chip)}
                        >
                          <X className="h-3 w-3" strokeWidth={3} />
                        </button>
                      </motion.span>
                    ))}
                  </AnimatePresence>
                </div>
                {suggestions.length > 0 ? (
                  <>
                    <p className="mt-5 text-[13px] font-medium text-text-tertiary">
                      Suggestions
                    </p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {suggestions.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-border-default bg-bg-surface px-3 text-[13px] text-text-secondary transition-colors duration-150 hover:border-accent-border hover:bg-accent-subtle hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
                          onClick={() => pushRoleChip(r)}
                        >
                          <Plus
                            className="h-3 w-3"
                            strokeWidth={2.5}
                            aria-hidden
                          />
                          {r}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {discoveryStep === 0 ? (
        <>
          <PrimaryCta disabled={savePending} onClick={onNext}>
            Get started
          </PrimaryCta>
          <p className="mt-4 text-[13px] text-text-tertiary">
            Free to start. No credit card needed.
          </p>
        </>
      ) : null}

      {discoveryStep === 1 ? (
        <PrimaryCta disabled={savePending} onClick={onNext}>
          Continue
        </PrimaryCta>
      ) : null}

      {discoveryStep === 3 ? (
        <PrimaryCta
          disabled={!rolesValid || savePending}
          onClick={() => {
            if (pendingRole.length >= 2) commitPendingRole();
            return onNext();
          }}
        >
          Continue
        </PrimaryCta>
      ) : null}
    </div>
  );
}

function ChoiceCard({
  Icon,
  title,
  body,
  selected,
  onClick,
}: {
  Icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.12 }}
      onClick={onClick}
      className={cn(
        'relative flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-[border-color,box-shadow,background-color] duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
        selected
          ? 'border-border-focus bg-accent-subtle shadow-[0_0_0_1px_var(--ck-border-focus),0_0_0_5px_var(--ck-accent-subtle)]'
          : 'border-border-default bg-bg-surface shadow-raised hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
          selected
            ? 'bg-accent-solid text-text-on-accent'
            : 'bg-accent-subtle text-accent-text',
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-text-primary">
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] text-text-secondary">
          {body}
        </span>
      </span>
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
          selected
            ? 'border-accent-solid bg-accent-solid text-text-on-accent'
            : 'border-border-strong bg-transparent',
        )}
        aria-hidden
      >
        {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>
    </motion.button>
  );
}
