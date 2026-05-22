'use client';

import { motion } from 'framer-motion';

import { trackMarketingCta } from '@/components/analytics/MarketingAnalytics';

import { AnimatedBorderCard } from './AnimatedBorderCard';
import { ChromeIcon } from './ChromeIcon';
import { GlowChromeCta } from './GlowChromeCta';
import { MatchScoreBar } from './MatchScoreBar';

const view = { once: true, margin: '-80px' as const };
const ease = [0.21, 0.47, 0.32, 0.98] as const;

export function FinalCta() {
  return (
    <section id="cta" className="px-[4%] pb-20">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={view}
        transition={{ duration: 0.6, ease }}
      >
        <AnimatedBorderCard
          radiusPx={28}
          contentClassName="relative overflow-hidden px-6 py-16 sm:px-10 lg:px-[72px] lg:py-16"
        >
          <div
            className="pointer-events-none absolute -left-[100px] -top-[100px] h-[400px] w-[400px] rounded-full opacity-[0.08]"
            style={{
              background:
                'radial-gradient(circle, rgba(0, 174, 175, 0.45) 0%, transparent 70%)',
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-[80px] -right-[80px] h-[300px] w-[300px] rounded-full opacity-[0.05]"
            style={{
              background:
                'radial-gradient(circle, rgba(0, 212, 212, 0.35) 0%, transparent 70%)',
            }}
            aria-hidden
          />

          <div className="relative grid grid-cols-1 items-center gap-[60px] lg:grid-cols-[minmax(0,55%)_minmax(0,45%)]">
            <div className="flex min-w-0 flex-col justify-center text-left">
              <p className="text-[11px] font-bold uppercase tracking-[3px] text-[#00C9B1]">
                GET STARTED TODAY
              </p>
              <h2 className="mt-4 max-w-[520px] text-[36px] font-extrabold tracking-[-1px] text-white sm:text-[48px]">
                Start applying smarter.
              </h2>
              <p className="mt-5 max-w-[440px] text-[15px] leading-[1.7] text-[rgba(255,255,255,0.5)]">
                Free forever. No credit card. Just better applications and more
                callbacks.
              </p>
              <div className="mt-10">
                <GlowChromeCta
                  href="#cta"
                  onClick={() => trackMarketingCta('chrome_extension', 'final_cta')}
                >
                  <ChromeIcon className="shrink-0" />
                  Add to Chrome — It&apos;s Free
                </GlowChromeCta>
              </div>
              <p className="mt-6 text-center text-[12px] text-[rgba(255,255,255,0.35)] sm:text-left">
                Already used by{' '}
                <span className="font-semibold text-[#00C9B1]">2,400+</span> job
                seekers this month
              </p>
            </div>

            <div className="flex min-w-0 w-full items-center justify-center lg:justify-end">
              <AnimatedBorderCard
                radiusPx={18}
                className="w-full max-w-[min(100%,480px)]"
                contentClassName="p-0"
              >
                <div className="rounded-[17px] border border-[rgba(0,201,177,0.14)] bg-[rgba(255,255,255,0.03)] px-9 py-9 sm:px-11 sm:py-10">
                  <MatchScoreBar
                    score={88}
                    label="Match Score"
                    size="featured"
                    skills={[
                      { name: 'React', matched: true },
                      { name: 'TypeScript', matched: true },
                      { name: 'Leadership', matched: true },
                    ]}
                  />
                </div>
              </AnimatedBorderCard>
            </div>
          </div>
        </AnimatedBorderCard>
      </motion.div>
    </section>
  );
}
