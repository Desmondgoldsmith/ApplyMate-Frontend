'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

import { ConicGlowBorder } from './ConicGlowBorder';
import { MatchScoreBar } from './MatchScoreBar';

const pills = ['LinkedIn', 'Greenhouse', 'Workday', 'Lever', 'Indeed', 'Glassdoor'];

export function Showcase() {
  return (
    <section id="showcase" className="px-4 sm:px-6 lg:px-[8%]">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{
          duration: 0.6,
          ease: [0.21, 0.47, 0.32, 0.98] as const,
        }}
      >
        <ConicGlowBorder className="overflow-hidden" innerClassName="p-0">
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-b border-[rgba(0,201,177,0.1)] p-8 lg:border-b-0 lg:border-r">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[2px] text-[rgba(255,255,255,0.25)]">
                Job posting
              </div>
              <h3 className="text-[22px] font-bold text-white">
                Senior Product Designer
              </h3>
              <p className="mt-1 text-[13px] text-[rgba(255,255,255,0.35)]">
                Northwind Labs · Remote (US)
              </p>
              <div className="mt-6 space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-2 rounded-full bg-[rgba(255,255,255,0.06)]"
                    style={{ width: `${90 - i * 8}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="p-8">
              <div className="mb-6 flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full bg-[#00C9B1]"
                  style={{ boxShadow: '0 0 10px #00C9B1' }}
                />
                <span className="text-[14px] font-bold text-white">ApplyMate</span>
              </div>
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <div className="w-full max-w-[260px] shrink-0 sm:w-[260px]">
                  <MatchScoreBar score={91} label="Match Score" />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <button
                    type="button"
                    className="w-full rounded-full bg-[#00C9B1] py-3 text-[12px] font-bold uppercase tracking-wider text-[#080A0A] transition-opacity hover:opacity-90"
                  >
                    Auto-Fill Application
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-full border border-[rgba(255,255,255,0.2)] py-3 text-[12px] font-bold uppercase tracking-wider text-white transition-colors hover:border-[rgba(0,201,177,0.45)]"
                  >
                    Generate Cover Letter
                  </button>
                  <ul className="space-y-2 pt-2 text-[13px] text-[rgba(255,255,255,0.65)]">
                    {['Product strategy', 'Design systems', 'Cross-functional leadership'].map(
                      (s) => (
                        <li key={s} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-[#00C9B1]" />
                          {s}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </ConicGlowBorder>

        <p className="mt-10 text-center text-[15px] text-[rgba(255,255,255,0.45)]">
          Works on every job board — install once, apply everywhere
        </p>
        <div className="mx-auto mt-6 flex max-w-[900px] flex-wrap justify-center gap-2">
          {pills.map((p) => (
            <span
              key={p}
              className="rounded-full border border-[rgba(0,201,177,0.2)] bg-[rgba(0,201,177,0.08)] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.65)]"
            >
              {p}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
