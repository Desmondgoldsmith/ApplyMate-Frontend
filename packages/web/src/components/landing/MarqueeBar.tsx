'use client';

import { motion } from 'framer-motion';

const companies = [
  'Google',
  'Meta',
  'Amazon',
  'Microsoft',
  'Stripe',
  'Airbnb',
  'Netflix',
  'Spotify',
  'Uber',
  'Apple',
  'OpenAI',
  'DeepMind',
];

function MarqueeTrack() {
  const items = companies.join(' · ');
  return (
    <div className="flex shrink-0 items-center gap-8 whitespace-nowrap px-8">
      <span className="text-[13px] font-medium uppercase tracking-[1px] text-[rgba(255,255,255,0.3)]">
        {items}
      </span>
    </div>
  );
}

export function MarqueeBar() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.6,
        ease: [0.21, 0.47, 0.32, 0.98] as const,
      }}
      className="mt-12 border-y border-[rgba(0,201,177,0.08)] pt-6 pb-5"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-3 px-4 sm:flex-row sm:px-[8%]">
        <p className="shrink-0 text-[12px] font-semibold uppercase tracking-[2px] text-[rgba(255,255,255,0.25)]">
          Trusted by job seekers at
        </p>
        <div
          className="relative w-full overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
          }}
        >
          <div className="flex w-max animate-marquee">
            <MarqueeTrack />
            <MarqueeTrack />
          </div>
        </div>
      </div>
    </motion.section>
  );
}
