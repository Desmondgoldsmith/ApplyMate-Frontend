'use client';

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

import { AnimatedBorderCard } from './AnimatedBorderCard';

const view = { once: true, margin: '-80px' as const };
const ease = [0.21, 0.47, 0.32, 0.98] as const;

const items = [
  {
    quote:
      'I went from spending 2 hours per application to under 5 minutes. The cover letters it generates are genuinely better than what I was writing myself.',
    initials: 'SK',
    name: 'Sarah K.',
    role: 'Software Engineer → hired at Stripe',
  },
  {
    quote:
      "The match score feature alone is worth it. I stopped wasting time applying to jobs I wasn't qualified for and focused on the right ones.",
    initials: 'MT',
    name: 'Marcus T.',
    role: 'Product Manager → hired at Airbnb',
  },
  {
    quote:
      'I applied to 40 jobs in one afternoon. Got 8 callbacks. This tool is absolutely insane.',
    initials: 'PM',
    name: 'Priya M.',
    role: 'Data Scientist → hired at Google',
  },
];

export function Testimonials() {
  return (
    <section className="px-4 py-[120px] sm:px-6 lg:px-[8%]">
      <motion.h2
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={view}
        transition={{ duration: 0.6, ease }}
        className="max-w-[720px] text-[32px] font-extrabold tracking-[-1px] text-white sm:text-[42px]"
      >
        Job seekers love ApplyMate
      </motion.h2>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {items.map((t) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={view}
            transition={{ duration: 0.6, ease }}
            className="h-full"
          >
            <AnimatedBorderCard className="h-full" contentClassName="p-8">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-[#00C9B1] text-[#00C9B1]"
                    aria-hidden
                  />
                ))}
              </div>
              <p className="mt-6 text-[15px] italic leading-[1.7] text-[rgba(255,255,255,0.75)]">
                “{t.quote}”
              </p>
              <div className="mt-8 flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[12px] font-bold text-white"
                  style={{ backgroundColor: 'rgba(0, 174, 175, 0.85)' }}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-[14px] font-semibold text-white">
                    {t.name}
                  </div>
                  <div className="text-[12px] text-[rgba(255,255,255,0.35)]">
                    {t.role}
                  </div>
                </div>
              </div>
            </AnimatedBorderCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
