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
    <div className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 text-left">
      <AnimatePresence mode="wait" initial={false}>
        {saved ? (
          <motion.p
            key="thanks"
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-[13px] text-white/60"
          >
            <Check className="h-4 w-4 text-[#00C9B1]" strokeWidth={3} />
            Thanks for telling us how you found CareerKite.
          </motion.p>
        ) : (
          <motion.div
            key="ask"
            exit={reducedMotion ? undefined : { opacity: 0 }}
          >
            <p className="text-[13px] font-medium text-white/75">
              One quick question: how did you hear about CareerKite?{' '}
              <span className="font-normal text-white/40">(optional)</span>
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
                    'rounded-full border px-3 py-1.5 text-[12px] transition-colors duration-150 disabled:opacity-50',
                    picked === opt
                      ? 'border-[#00C9B1] bg-[rgba(0,201,177,0.12)] text-white'
                      : 'border-white/[0.12] text-white/65 hover:border-white/[0.25] hover:text-white',
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
                  className="h-10 flex-1 rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-[#00C9B1]"
                />
                <button
                  type="submit"
                  disabled={saving || other.trim().length < 2}
                  className="h-10 rounded-lg bg-[rgba(0,201,177,0.15)] px-4 text-[13px] font-semibold text-[#00C9B1] disabled:opacity-40"
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
