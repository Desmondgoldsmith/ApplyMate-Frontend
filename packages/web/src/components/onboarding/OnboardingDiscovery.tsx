'use client';

import type { ComponentType } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  MoreHorizontal,
  Rocket,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

import type { JobSearchUrgency } from '@/lib/onboardingWizardStorage';
import { InfoHint } from '@/components/ui/InfoHint';
import { cn } from '@/lib/utils';

function MessageCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 1 0-4 0v7h-4v-7a6 6 0 0 1 6-6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2 9h4v12H2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="4" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function VideoSocialIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9.5V14.5L15 12L10 9.5Z" fill="currentColor" />
    </svg>
  );
}

const REFERRAL_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
}> = [
  { value: 'Google search', label: 'Google search', Icon: Search },
  { value: 'LinkedIn', label: 'LinkedIn', Icon: LinkedInIcon },
  { value: 'Twitter / X', label: 'Twitter / X', Icon: Sparkles },
  { value: 'Friend or colleague', label: 'Friend or colleague', Icon: Users },
  { value: 'Product Hunt', label: 'Product Hunt', Icon: VideoSocialIcon },
  { value: 'Blog or article', label: 'Blog or article', Icon: MessageCircleIcon },
  { value: 'Other', label: 'Other', Icon: MoreHorizontal },
];

const SUGGESTED_ROLES = [
  'Product Manager',
  'Software Engineer',
  'UX Designer',
  'Marketing Manager',
  'Data Analyst',
] as const;

function sectionLabel(text: string) {
  return (
    <p
      className="text-center text-[11px] font-medium uppercase text-[#00C9B1]"
      style={{ letterSpacing: '0.12em' }}
    >
      {text}
    </p>
  );
}

function OnboardingBackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group mb-8 flex min-h-[44px] cursor-pointer items-center gap-1.5 self-start text-[13px] text-[rgba(255,255,255,0.45)] transition-colors duration-200 hover:text-[rgba(255,255,255,0.8)]"
    >
      <ArrowLeft className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
      Back
    </button>
  );
}

function OnboardingPrimaryCta({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <div className="mt-8 flex w-full justify-center sm:mt-8">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void onClick()}
        className={cn(
          'flex h-[52px] min-h-[52px] w-full min-w-[200px] cursor-pointer items-center justify-center gap-2 rounded-xl px-8 text-[15px] font-semibold text-white transition-all duration-200 sm:w-auto',
          'bg-[#00C9B1] active:scale-[0.99]',
          'disabled:cursor-not-allowed disabled:opacity-[0.35]',
          'hover:scale-[1.01] hover:brightness-[1.08] hover:shadow-[0_0_24px_rgba(0,201,177,0.25)]',
        )}
      >
        {children}
        <ArrowRight className="h-4 w-4 opacity-90" strokeWidth={2.5} />
      </button>
    </div>
  );
}

type OnboardingDiscoveryProps = {
  firstName: string;
  discoveryStep: number;
  focusHired: boolean;
  focusStudent: boolean;
  onToggleHired: () => void;
  onToggleStudent: () => void;
  jobSearchUrgency: JobSearchUrgency | null;
  onSelectUrgency: (v: JobSearchUrgency) => void;
  targetRolesText: string;
  onTargetRolesChange: (v: string) => void;
  referralSource: string;
  onReferralSourceChange: (v: string) => void;
  referralOther: string;
  onReferralOtherChange: (v: string) => void;
  onBack: () => void;
  /** Pass `true` when the user skips the referral question (valid API payload). */
  onNext: (referralSkipped?: boolean) => void | Promise<void>;
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
  focusHired,
  focusStudent,
  onToggleHired,
  onToggleStudent,
  jobSearchUrgency,
  onSelectUrgency,
  targetRolesText,
  onTargetRolesChange,
  referralSource,
  onReferralSourceChange,
  referralOther,
  onReferralOtherChange,
  onBack,
  onNext,
  savePending,
}: OnboardingDiscoveryProps) {
  const reducedMotion = useReducedMotion();
  const [roleInput, setRoleInput] = useState('');
  const [showTapHint, setShowTapHint] = useState(false);
  const urgencyTimerRef = useRef<number | null>(null);
  const referralTimerRef = useRef<number | null>(null);

  const greeting =
    firstName.trim().length > 0 ? `Welcome, ${firstName.trim()}.` : 'Welcome to ApplyMate.';

  const focusValid = focusHired || focusStudent;
  const timelineValid = jobSearchUrgency !== null;
  const rolesValid = parseRolesFromText(targetRolesText).length >= 1;
  const referralValid =
    referralSource.trim().length > 0 &&
    (referralSource !== 'Other' || referralOther.trim().length > 0);

  const canNext =
    discoveryStep === 0
      ? true
      : discoveryStep === 1
        ? focusValid
        : discoveryStep === 2
          ? timelineValid
          : discoveryStep === 3
            ? rolesValid
            : referralValid;

  const clearUrgencyTimer = useCallback(() => {
    if (urgencyTimerRef.current != null) {
      window.clearTimeout(urgencyTimerRef.current);
      urgencyTimerRef.current = null;
    }
  }, []);

  const clearReferralTimer = useCallback(() => {
    if (referralTimerRef.current != null) {
      window.clearTimeout(referralTimerRef.current);
      referralTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearUrgencyTimer();
      clearReferralTimer();
    };
  }, [clearReferralTimer, clearUrgencyTimer]);

  useEffect(() => {
    if (discoveryStep !== 2) {
      setShowTapHint(false);
      return;
    }
    if (jobSearchUrgency !== null) {
      setShowTapHint(false);
      return;
    }
    const id = window.setTimeout(() => setShowTapHint(true), 2000);
    return () => window.clearTimeout(id);
  }, [discoveryStep, jobSearchUrgency]);

  const handleUrgencyPick = (v: JobSearchUrgency) => {
    clearUrgencyTimer();
    onSelectUrgency(v);
    urgencyTimerRef.current = window.setTimeout(() => {
      void onNext();
    }, 300);
  };

  const handleReferralPick = (value: string) => {
    clearReferralTimer();
    onReferralSourceChange(value);
    if (value !== 'Other') {
      onReferralOtherChange('');
      referralTimerRef.current = window.setTimeout(() => {
        void onNext();
      }, 400);
    }
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
    const next = [...existing, t].join(', ');
    onTargetRolesChange(next);
    setRoleInput('');
  };

  const removeRoleChip = (label: string) => {
    const next = parseRolesFromText(targetRolesText).filter((x) => x !== label);
    onTargetRolesChange(next.join(', '));
  };

  const roleChips = useMemo(() => parseRolesFromText(targetRolesText), [targetRolesText]);

  const onRolesKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      pushRoleChip(roleInput.replace(/,$/, ''));
    }
  };

  useEffect(() => {
    clearReferralTimer();
    if (discoveryStep !== 4 || referralSource !== 'Other') return;
    if (referralOther.trim().length < 2) return;
    referralTimerRef.current = window.setTimeout(() => {
      void onNext();
    }, 400);
    return () => clearReferralTimer();
  }, [clearReferralTimer, discoveryStep, onNext, referralOther, referralSource]);

  const stepMotionProps = reducedMotion
    ? { initial: false, animate: { opacity: 1, x: 0 } }
    : {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { duration: 0.2, ease: 'easeOut' as const },
      };

  const primaryCtaLabel = discoveryStep === 1 && !focusValid ? 'Select an option to continue' : 'Next';

  return (
    <div className="flex w-full flex-col items-center text-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={discoveryStep}
          {...stepMotionProps}
          className="flex w-full max-w-[480px] flex-col items-center sm:max-w-[560px]"
        >
          {discoveryStep === 0 ? (
            <>
              {sectionLabel('Welcome')}
              <motion.div
                className="mb-3 flex h-8 w-8 items-center justify-center text-[#00C9B1]"
                animate={reducedMotion ? undefined : { y: [0, -4, 0] }}
                transition={reducedMotion ? undefined : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden
              >
                <Sparkles className="h-8 w-8" strokeWidth={1.5} />
              </motion.div>
              <h1 className="max-w-[480px] text-[26px] font-bold leading-[1.2] text-white sm:text-[32px]">
                {greeting}
              </h1>
              <p className="mt-4 max-w-[440px] text-[14px] leading-[1.6] text-[rgba(255,255,255,0.55)] sm:mt-4 sm:text-[15px]">
                We tailor ApplyMate to your goals in about two minutes.
              </p>
            </>
          ) : null}

          {discoveryStep === 1 ? (
            <>
              <OnboardingBackLink onClick={onBack} />
              {sectionLabel('Your focus')}
              <h1 className="mt-3 max-w-[480px] text-[26px] font-bold leading-[1.2] text-white sm:text-[32px]">
                What would you like the most help with right now?
              </h1>
              <p className="mt-4 max-w-[440px] text-[14px] leading-[1.6] text-[rgba(255,255,255,0.55)] sm:text-[15px]">
                Select one or both — we&apos;ll tailor your workspace around it.
              </p>
              <div className="mt-8 flex w-full flex-col gap-3 sm:mt-8">
                <OutcomeCard
                  icon={Rocket}
                  title="Get hired faster"
                  description="Resume that stands out, smarter job tracking, and interview prep — all working together."
                  selected={focusHired}
                  onClick={onToggleHired}
                />
                <OutcomeCard
                  icon={GraduationCap}
                  title="Student career launchpad"
                  description="Guided support if you&apos;re studying or just starting out and want a clear path forward."
                  selected={focusStudent}
                  onClick={onToggleStudent}
                />
              </div>
            </>
          ) : null}

          {discoveryStep === 2 ? (
            <>
              <OnboardingBackLink onClick={onBack} />
              {sectionLabel('Timing')}
              <h1 className="mt-3 max-w-[480px] text-[26px] font-bold leading-[1.2] text-white sm:text-[32px]">
                When would you like to start your next opportunity?
              </h1>
              <p className="mt-4 max-w-[440px] text-[14px] leading-[1.6] text-[rgba(255,255,255,0.55)] sm:text-[15px]">
                No wrong answers — this helps us prioritise what matters to you.
                <span className="ml-1 inline-flex align-middle">
                  <InfoHint text="Your timing choice tunes recommendations and reminders. You can change it later in Settings." />
                </span>
              </p>
              <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-3">
                <UrgencyCard
                  label="As soon as possible"
                  description={"I'm actively applying or about to be."}
                  selected={jobSearchUrgency === 'asap'}
                  onClick={() => handleUrgencyPick('asap')}
                />
                <UrgencyCard
                  label="In the next few months"
                  description={"I'm preparing and want to be ready when the right role appears."}
                  selected={jobSearchUrgency === 'few_months'}
                  onClick={() => handleUrgencyPick('few_months')}
                />
                <UrgencyCard
                  label={"I'm exploring for now"}
                  description={"I'm learning what's out there and building my profile."}
                  selected={jobSearchUrgency === 'exploring'}
                  onClick={() => handleUrgencyPick('exploring')}
                />
              </div>
              {showTapHint ? (
                <p className="mt-3 text-[11px] text-[rgba(255,255,255,0.35)]">Tap an option to continue</p>
              ) : (
                <p className="mt-3 text-[11px] text-transparent">.</p>
              )}
            </>
          ) : null}

          {discoveryStep === 3 ? (
            <>
              <OnboardingBackLink onClick={onBack} />
              {sectionLabel('Your target')}
              <h1 className="mt-3 max-w-[480px] text-[26px] font-bold leading-[1.2] text-white sm:text-[32px]">
                What role or position are you targeting?
              </h1>
              <p className="mt-4 max-w-[440px] text-[14px] leading-[1.6] text-[rgba(255,255,255,0.55)] sm:text-[15px]">
                Add one or more job titles. We use this to personalise matches and suggestions later.
                <span className="ml-1 inline-flex align-middle">
                  <InfoHint text="Target roles guide job matching, priority suggestions, and CV wording hints." />
                </span>
              </p>
              <div className="mt-8 w-full sm:mt-8">
                <input
                  type="text"
                  value={roleInput}
                  onChange={(e) => setRoleInput(e.target.value)}
                  onKeyDown={onRolesKeyDown}
                  placeholder="Type a job title and press Enter"
                  className="h-12 w-full min-h-[48px] rounded-[10px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 text-left text-[14px] text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[rgba(255,255,255,0.3)] focus:border-[#00C9B1] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.15)]"
                />
                {roleChips.length > 0 ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {roleChips.map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex items-center gap-1.5 rounded-[20px] border border-[rgba(0,201,177,0.35)] bg-[rgba(0,201,177,0.15)] px-3 py-1 text-[12px] font-medium text-[#00C9B1]"
                      >
                        {chip}
                        <button
                          type="button"
                          aria-label={`Remove ${chip}`}
                          className="cursor-pointer rounded-full p-0.5 text-[#00C9B1] hover:bg-[rgba(0,201,177,0.2)]"
                          onClick={() => removeRoleChip(chip)}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-4 text-[12px] text-[rgba(255,255,255,0.35)]">Popular roles — tap to add</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {SUGGESTED_ROLES.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="cursor-pointer rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-3 py-1.5 text-[12px] text-[rgba(255,255,255,0.65)] transition-colors duration-150 hover:border-[rgba(255,255,255,0.22)] hover:bg-[rgba(255,255,255,0.06)]"
                      onClick={() => pushRoleChip(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {discoveryStep === 4 ? (
            <>
              <OnboardingBackLink onClick={onBack} />
              {sectionLabel('Almost there')}
              <h1 className="mt-3 max-w-[480px] text-[26px] font-bold leading-[1.2] text-white sm:text-[32px]">
                How did you hear about us?
              </h1>
              <p className="mt-4 max-w-[440px] text-[14px] leading-[1.6] text-[rgba(255,255,255,0.55)] sm:text-[15px]">
                Helpful for us — pick the closest match.
              </p>
              <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:mt-8">
                {REFERRAL_OPTIONS.map(({ value, label, Icon }) => {
                  const selected = referralSource === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleReferralPick(value)}
                      className={cn(
                        'flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 transition-all duration-150',
                        selected
                          ? 'border-[#00C9B1] bg-[rgba(0,201,177,0.08)] [border-width:1.5px]'
                          : 'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.06)]',
                      )}
                    >
                      <Icon className="h-5 w-5 text-[#00C9B1]" />
                      <span className="text-center text-[14px] font-medium text-white">{label}</span>
                    </button>
                  );
                })}
              </div>
              {referralSource === 'Other' ? (
                <div className="mt-4 w-full">
                  <label className="sr-only" htmlFor="onb-referral-other">
                    Tell us more
                  </label>
                  <input
                    id="onb-referral-other"
                    type="text"
                    value={referralOther}
                    onChange={(e) => onReferralOtherChange(e.target.value)}
                    placeholder="Where did you find us?"
                    className="h-12 w-full min-h-[48px] rounded-[10px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] px-4 text-[14px] text-white outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-[rgba(255,255,255,0.3)] focus:border-[#00C9B1] focus:shadow-[0_0_0_3px_rgba(0,201,177,0.15)]"
                  />
                </div>
              ) : null}
              <button
                type="button"
                className="mt-6 cursor-pointer text-[12px] text-[rgba(255,255,255,0.35)] transition-colors hover:text-[rgba(255,255,255,0.55)]"
                onClick={() => void onNext(true)}
              >
                Skip this step →
              </button>
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {discoveryStep !== 2 && discoveryStep !== 4 ? (
        <OnboardingPrimaryCta
          disabled={!canNext || savePending}
          onClick={() => void onNext()}
        >
          {primaryCtaLabel}
        </OnboardingPrimaryCta>
      ) : null}

      {discoveryStep === 0 ? (
        <p className="mt-6 text-[12px] text-[rgba(255,255,255,0.3)]">
          No credit card required · Takes 2 minutes
        </p>
      ) : null}
    </div>
  );
}

function OutcomeCard({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative flex w-full cursor-pointer gap-4 rounded-xl border py-5 pl-5 pr-14 text-left transition-all duration-150',
        selected
          ? 'border-[#00C9B1] bg-[rgba(0,201,177,0.08)] [border-width:1.5px]'
          : 'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.06)]',
      )}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,177,0.15)]"
        aria-hidden
      >
        <Icon className="h-[18px] w-[18px] text-[#00C9B1]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-white">{title}</p>
        <p className="mt-1 text-[13px] leading-snug text-[rgba(255,255,255,0.5)]">{description}</p>
      </div>
      <SelectionRing selected={selected} />
    </motion.button>
  );
}

function SelectionRing({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        'pointer-events-none absolute right-4 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border transition-all duration-200',
        selected ? 'border-[#00C9B1] bg-[#00C9B1]' : 'border-[rgba(255,255,255,0.15)] bg-transparent',
      )}
      aria-hidden
    >
      <motion.span
        initial={false}
        animate={{ scale: selected ? 1 : 0.85, opacity: selected ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="flex items-center justify-center"
      >
        {selected ? <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> : null}
      </motion.span>
    </span>
  );
}

function UrgencyCard({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.1 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'relative flex w-full cursor-pointer gap-3 rounded-xl border py-5 pl-5 pr-14 text-left transition-all duration-150',
        selected
          ? 'border-[#00C9B1] bg-[rgba(0,201,177,0.08)] [border-width:1.5px]'
          : 'border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.06)]',
      )}
    >
      <div
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(0,201,177,0.15)]"
        aria-hidden
      >
        <Sparkles className="h-[18px] w-[18px] text-[#00C9B1]" />
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-white">{label}</p>
        <p className="mt-1 text-[13px] text-[rgba(255,255,255,0.5)]">{description}</p>
      </div>
      <SelectionRing selected={selected} />
    </motion.button>
  );
}
