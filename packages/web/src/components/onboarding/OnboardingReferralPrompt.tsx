'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState } from 'react';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Must match `REFERRAL_SOURCES` in the API onboarding DTO. */
const REFERRAL_OPTIONS = [
  'Google search',
  'LinkedIn',
  'Friend or colleague',
  'Twitter / X',
  'Product Hunt',
  'Blog or article',
  'Other',
] as const;

/** Optional "how did you hear about us" — asked after the user has seen value, never blocking. */
export function OnboardingReferralPrompt({
  initialSource,
}: {
  initialSource?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [picked, setPicked] = useState<string>(initialSource ?? '');
  const [other, setOther] = useState('');
  const [saved, setSaved] = useState(Boolean(initialSource));
  const [saving, setSaving] = useState(false);

  const save = async (source: string, otherText?: string) => {
    setSaving(true);
    try {
      await api.onboarding.saveProgress({
        step: 3,
        completed: true,
        referralSource: source,
        ...(source === 'Other' ? { referralOther: otherText?.trim() } : {}),
      });
      setSaved(true);
    } catch {
      /* optional question — never surface an error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full rounded-2xl border border-border-subtle bg-bg-surface px-4 py-4 text-left shadow-raised">
      <AnimatePresence mode="wait" initial={false}>
        {saved ? (
          <motion.p
            key="thanks"
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-[13px] text-text-secondary"
          >
            <Check className="h-4 w-4 text-accent-text" strokeWidth={3} />
            Thanks for telling us how you found CareerKite.
          </motion.p>
        ) : (
          <motion.div
            key="ask"
            exit={reducedMotion ? undefined : { opacity: 0 }}
          >
            <p className="text-[13px] font-medium text-text-secondary">
              One quick question: how did you hear about CareerKite?{' '}
              <span className="font-normal text-text-tertiary">(optional)</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {REFERRAL_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  disabled={saving}
                  aria-pressed={picked === opt}
                  onClick={() => {
                    setPicked(opt);
                    if (opt !== 'Other') void save(opt);
                  }}
                  className={cn(
                    'min-h-[36px] rounded-full border px-3 text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:opacity-50',
                    picked === opt
                      ? 'border-accent-solid bg-accent-subtle font-semibold text-text-primary'
                      : 'border-border-default text-text-secondary hover:border-border-strong hover:text-text-primary',
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
            {picked === 'Other' ? (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (other.trim().length >= 2) void save('Other', other);
                }}
              >
                <label htmlFor="onb-referral-other" className="sr-only">
                  Where did you hear about us?
                </label>
                <input
                  id="onb-referral-other"
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  placeholder="Where did you hear about us?"
                  maxLength={500}
                  className="h-11 flex-1 rounded-xl border border-border-strong bg-bg-sunken px-3 text-[14px] text-text-primary outline-none placeholder:text-text-tertiary focus:border-border-focus focus:bg-bg-surface"
                />
                <button
                  type="submit"
                  disabled={saving || other.trim().length < 2}
                  className="h-11 rounded-xl bg-accent-solid px-5 text-[14px] font-semibold text-text-on-accent hover:bg-accent-solid-hover disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
