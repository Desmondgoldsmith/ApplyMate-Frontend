'use client';

import type { ComponentType, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
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

import type { JobSearchUrgency } from '@/lib/onboardingWizardStorage';
import { OnboardingBackLink } from '@/components/onboarding/OnboardingBackLink';
import {
  ONBOARDING_SUBTITLE_CLASS,
  ONBOARDING_TITLE_CLASS,
} from '@/components/onboarding/onboardingLayout';
import { cn } from '@/lib/utils';

/** Discovery screens in order. `1` (focus) and `4` (referral) are retired but may exist in old saved state. */
export const DISCOVERY_STEPS = [0, 2, 3] as const;
export type DiscoveryStep = (typeof DISCOVERY_STEPS)[number];

export function normalizeDiscoveryStep(raw: number): DiscoveryStep {
  if (raw >= 3) return 3;
  if (raw >= 1) return 2;
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

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00C9B1]">
      {children}
    </p>
  );
}

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
      <motion.button
        type="button"
        disabled={disabled}
        onClick={() => void onClick()}
        whileHover={disabled ? undefined : { y: -1 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        className={cn(
          'group flex h-[52px] w-full min-w-[220px] items-center justify-center gap-2 rounded-xl px-8 text-[15px] font-semibold text-[#080A0A] sm:w-auto',
          'bg-[#00C9B1] shadow-[0_8px_30px_rgba(0,201,177,0.25)] transition-[box-shadow,filter,opacity] duration-200',
          'hover:shadow-[0_10px_36px_rgba(0,201,177,0.38)] hover:brightness-105',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none',
        )}
      >
        {children}
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          strokeWidth={2.5}
        />
      </motion.button>
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
      : 'Welcome to ApplyMate.';

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
          className="flex w-full max-w-[560px] flex-col items-center"
        >
          {discoveryStep === 0 ? (
            <>
              <Eyebrow>Welcome</Eyebrow>
              <h1 className={cn(ONBOARDING_TITLE_CLASS, 'mt-3')}>{greeting}</h1>
              <p className={ONBOARDING_SUBTITLE_CLASS}>
                Let&apos;s set up ApplyMate around your job search. It takes
                about two minutes.
              </p>
              <ul className="mt-8 w-full space-y-2.5 text-left">
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
                    className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 backdrop-blur-sm"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(0,201,177,0.12)] ring-1 ring-[rgba(0,201,177,0.25)]">
                      <Icon className="h-[18px] w-[18px] text-[#00C9B1]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-semibold text-white">
                        {title}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-white/55">
                        {body}
                      </span>
                    </span>
                  </motion.li>
                ))}
              </ul>
            </>
          ) : null}

          {discoveryStep === 2 ? (
            <>
              <OnboardingBackLink onClick={onBack} />
              <Eyebrow>Your timeline</Eyebrow>
              <h1 className={cn(ONBOARDING_TITLE_CLASS, 'mt-3')}>
                When do you want to start a new role?
              </h1>
              <p className={ONBOARDING_SUBTITLE_CLASS}>
                We&apos;ll pace reminders and suggestions to match. You can
                change this later.
              </p>
              <div
                className="mt-8 flex w-full flex-col gap-3"
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
              <Eyebrow>Your target roles</Eyebrow>
              <h1 className={cn(ONBOARDING_TITLE_CLASS, 'mt-3')}>
                What roles are you aiming for?
              </h1>
              <p className={ONBOARDING_SUBTITLE_CLASS}>
                Add one or more job titles. We use them to find matching jobs
                and tailor your suggestions.
              </p>
              <div className="mt-8 w-full">
                <label htmlFor="onb-role-input" className="sr-only">
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
                    placeholder="Type a job title, e.g. Frontend Developer"
                    autoComplete="off"
                    className="h-12 min-h-[48px] flex-1 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 text-left text-[14px] text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-white/35 focus:border-[#00C9B1] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.15)]"
                  />
                  <button
                    type="button"
                    disabled={pendingRole.length < 2}
                    onClick={commitPendingRole}
                    className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl border border-[rgba(0,201,177,0.35)] bg-[rgba(0,201,177,0.12)] px-4 text-[13px] font-semibold text-[#00C9B1] transition enabled:hover:bg-[rgba(0,201,177,0.2)] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                    Add
                  </button>
                </div>
                <p className="mt-2 text-left text-[12px] text-white/45">
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
                        className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,201,177,0.4)] bg-[rgba(0,201,177,0.14)] py-1 pl-3 pr-1.5 text-[13px] font-medium text-[#7EE8D8]"
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
                          className="rounded-full p-1 text-[#7EE8D8] hover:bg-[rgba(0,201,177,0.22)]"
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
                    <p className="mt-5 text-[12px] font-medium text-white/45">
                      Suggestions
                    </p>
                    <div className="mt-2 flex flex-wrap justify-center gap-2">
                      {suggestions.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-[13px] text-white/70 transition-colors duration-150 hover:border-[rgba(0,201,177,0.4)] hover:bg-[rgba(0,201,177,0.08)] hover:text-white"
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
          <p className="mt-5 text-[12px] text-white/35">
            Free to start · No credit card needed
          </p>
        </>
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
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.12 }}
      onClick={onClick}
      className={cn(
        'relative flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-colors duration-150',
        selected
          ? 'border-[#00C9B1] bg-[rgba(0,201,177,0.08)] shadow-[0_0_0_1px_rgba(0,201,177,0.5)]'
          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/[0.2] hover:bg-white/[0.05]',
      )}
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors',
          selected
            ? 'bg-[#00C9B1] text-[#080A0A]'
            : 'bg-[rgba(0,201,177,0.12)] text-[#00C9B1]',
        )}
        aria-hidden
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-white">
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] text-white/55">{body}</span>
      </span>
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200',
          selected
            ? 'border-[#00C9B1] bg-[#00C9B1]'
            : 'border-white/[0.2] bg-transparent',
        )}
        aria-hidden
      >
        {selected ? (
          <Check className="h-3.5 w-3.5 text-[#080A0A]" strokeWidth={3} />
        ) : null}
      </span>
    </motion.button>
  );
}
