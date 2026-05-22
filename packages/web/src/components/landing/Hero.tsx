'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import type { CSSProperties } from 'react';

import { trackMarketingCta } from '@/components/analytics/MarketingAnalytics';

import { ChromeIcon } from './ChromeIcon';
import { GlowChromeCta } from './GlowChromeCta';
import { HeroSpline } from './HeroSpline';

const ease = [0.21, 0.47, 0.32, 0.98] as const;

const line1 = ['Apply', 'Smarter.'];
const line2 = ['Get', 'Hired', 'Faster.'];
const line3 = ['Powered', 'by', 'AI.'];

function WordLine({
  words,
  accentIndices,
}: {
  words: string[];
  accentIndices?: Set<number>;
}) {
  return (
    <span className="flex flex-wrap gap-x-[0.25em] gap-y-0">
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          className="inline-block"
          style={{
            color: accentIndices?.has(i) ? '#00C9B1' : '#FFFFFF',
          }}
        >
          {w}
        </span>
      ))}
    </span>
  );
}

const avatars = ['SK', 'MT', 'PM', 'JL', 'AR'];
const avatarColors = [
  'rgba(0,201,177,0.85)',
  'rgba(0,122,123,0.9)',
  'rgba(0,212,212,0.75)',
  'rgba(0,201,177,0.55)',
  'rgba(0,122,123,0.7)',
];

/** Wider fade so the orb doesn’t cut off sharply against the copy column */
const splineMask: CSSProperties = {
  WebkitMaskImage:
    'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.2) 28%, rgba(0,0,0,0.75) 48%, black 62%)',
  maskImage:
    'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.2) 28%, rgba(0,0,0,0.75) 48%, black 62%)',
};

/** Soft depth on the left only — no extra horizontal “wall” into black */
const heroAtmosphere: CSSProperties = {
  backgroundImage:
    'radial-gradient(ellipse 80% 95% at 26% 48%, rgba(0,201,177,0.04) 0%, rgba(6,10,10,0.22) 38%, transparent 65%)',
};

/** Full-width base (lg): one smooth ramp from page teal-black into deep black */
const heroBaseBlend: CSSProperties = {
  background:
    'linear-gradient(90deg, #060A0A 0%, #060A0A 18%, #071010 30%, #050B0B 40%, #030707 50%, #020404 58%, #010202 66%, #000000 76%, #000000 100%)',
};

/** Spline column: feather the left edge so it never meets the text column as a hard vertical seam */
const splineColumnFeather: CSSProperties = {
  background:
    'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 6%, rgba(0,0,0,0.2) 18%, rgba(0,0,0,0.65) 34%, rgba(0,0,0,0.95) 46%, #000000 56%, #000000 100%)',
};

export function Hero() {
  return (
    <section className="relative z-[1] min-h-[100svh] overflow-hidden bg-[#060A0A] pt-[72px]">
      {/* Single smooth left → right ramp (desktop); spline column feathers on top */}
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden lg:block"
        style={heroBaseBlend}
        aria-hidden
      />

      {/* Spline shell: left edge fades from transparent so base gradient shows through — no hard split */}
      <div
        className="pointer-events-none absolute right-0 top-1/2 z-0 hidden h-[120%] w-[58%] max-w-[820px] -translate-y-1/2 overflow-hidden lg:block"
        style={splineColumnFeather}
        aria-hidden
      >
        <div
          className="h-full w-full -translate-x-[8%]"
          style={splineMask}
        >
          <HeroSpline />
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={heroAtmosphere}
        aria-hidden
      />

      <div className="relative z-[2] flex min-h-[calc(100svh-72px)] flex-col">
        <div className="relative z-[2] flex w-full flex-col justify-center px-4 sm:px-6 lg:w-[55%] lg:pl-[8%] lg:pr-8 lg:py-0">
          <div className="mt-6 flex flex-col sm:mt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="mb-6 inline-flex items-center gap-3"
            >
              <span
                className="select-none text-[11px] leading-none tracking-[0.25em] text-[rgba(0,201,177,0.55)]"
                style={{ fontFamily: 'system-ui, sans-serif' }}
                aria-hidden
              >
                ★★
              </span>
              <span className="text-[12px] font-semibold uppercase tracking-[2.5px] text-[rgba(0,201,177,0.92)] sm:text-[13px] sm:tracking-[3px]">
                Now in Beta — Free to use
              </span>
              <span
                className="select-none text-[11px] leading-none tracking-[0.25em] text-[rgba(0,201,177,0.55)]"
                style={{ fontFamily: 'system-ui, sans-serif' }}
                aria-hidden
              >
                ★★
              </span>
            </motion.div>

            <h1 className="max-w-[640px] text-[42px] font-extrabold leading-[1.05] tracking-[-2px] text-white sm:text-[54px] lg:text-[68px]">
              <motion.div
                className="block"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.1, ease }}
              >
                <WordLine words={line1} />
              </motion.div>
              <motion.div
                className="mt-1 block"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.2, ease }}
              >
                <WordLine words={line2} />
              </motion.div>
              <motion.div
                className="mt-1 block"
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.3, ease }}
              >
                <WordLine
                  words={line3}
                  accentIndices={new Set([0, 1, 2])}
                />
              </motion.div>
            </h1>

            <motion.p
              className="mt-5 max-w-[480px] text-[15px] leading-[1.7] text-[rgba(255,255,255,0.5)] sm:text-[16px]"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.4, ease }}
            >
              ApplyMate reads the job description, scores your CV match,
              auto-fills the entire application, and writes your cover letter —
              all in seconds.
            </motion.p>

            <motion.div
              className="mt-10 flex flex-col gap-3.5 sm:flex-row sm:items-center"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.5, ease }}
            >
              <GlowChromeCta
                href="#cta"
                onClick={() => trackMarketingCta('chrome_extension', 'hero')}
              >
                <ChromeIcon className="shrink-0" />
                Add to Chrome — It&apos;s Free
              </GlowChromeCta>
              <Link
                href="#showcase"
                onClick={() => trackMarketingCta('watch_demo', 'hero')}
                className="inline-flex items-center justify-center rounded-full border border-[rgba(255,255,255,0.2)] px-8 py-3.5 text-[13px] font-semibold text-[rgba(255,255,255,0.7)] transition-[border-color,color] duration-200 hover:border-[rgba(0,201,177,0.5)] hover:text-white"
              >
                Watch Demo →
              </Link>
            </motion.div>

            <motion.div
              className="mt-10 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.6, ease }}
            >
              <div className="flex items-center pl-1">
                {avatars.map((initials, i) => (
                  <div
                    key={initials}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#060A0A] text-[10px] font-bold text-white"
                    style={{
                      marginLeft: i === 0 ? 0 : -8,
                      backgroundColor: avatarColors[i],
                    }}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-[rgba(255,255,255,0.45)]">
                Join{' '}
                <span className="font-semibold text-[#00C9B1]">2,400+</span> job
                seekers already using ApplyMate
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
