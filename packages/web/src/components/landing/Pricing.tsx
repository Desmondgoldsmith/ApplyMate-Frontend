'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { AnimatedBorderCard } from './AnimatedBorderCard';

const view = { once: true, margin: '-80px' as const };
const ease = [0.21, 0.47, 0.32, 0.98] as const;

function Feature({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[14px] text-[rgba(255,255,255,0.65)]">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#00C9B1]" />
      {children}
    </li>
  );
}

export function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="px-4 pb-[120px] sm:px-6 lg:px-[8%]">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={view}
        transition={{ duration: 0.6, ease }}
        className="text-center"
      >
        <h2 className="text-[32px] font-extrabold tracking-[-1px] text-white sm:text-[42px]">
          Simple, honest pricing
        </h2>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-[rgba(0,201,177,0.15)] bg-[rgba(255,255,255,0.02)] p-1.5 pl-4">
          <span
            className={`text-[12px] font-semibold ${!yearly ? 'text-white' : 'text-[rgba(255,255,255,0.35)]'}`}
          >
            Monthly
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={yearly}
            onClick={() => setYearly((y) => !y)}
            className="relative h-8 w-[52px] rounded-full transition-colors duration-300"
            style={{
              backgroundColor: yearly ? '#00C9B1' : 'rgba(255,255,255,0.1)',
            }}
          >
            <span
              className="absolute top-1 h-6 w-6 rounded-full bg-[#080A0A] shadow transition-transform duration-300"
              style={{ left: yearly ? 26 : 4 }}
            />
          </button>
          <span
            className={`pr-3 text-[12px] font-semibold ${yearly ? 'text-white' : 'text-[rgba(255,255,255,0.35)]'}`}
          >
            Yearly{' '}
            <span className="text-[#00C9B1]">(save 40%)</span>
          </span>
        </div>
      </motion.div>

      <div className="mx-auto mt-14 grid max-w-[880px] gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={view}
          transition={{ duration: 0.6, ease }}
          className="h-full"
        >
          <AnimatedBorderCard className="h-full" contentClassName="p-10">
            <h3 className="text-[22px] font-bold text-white">Free</h3>
            <p className="mt-4 text-[28px] font-extrabold text-white">
              $0 / month
            </p>
            <ul className="mt-8 space-y-3">
              <Feature>Chrome extension</Feature>
              <Feature>CV upload & storage</Feature>
              <Feature>Match score on every job</Feature>
              <Feature>10 auto-fills per month</Feature>
              <Feature>Basic cover letter templates</Feature>
            </ul>
            <a
              href="#cta"
              className="mt-10 flex w-full items-center justify-center rounded-full bg-white py-3.5 text-[13px] font-bold text-[#080A0A] transition-colors duration-200 hover:bg-[#00C9B1]"
            >
              Get Started Free
            </a>
          </AnimatedBorderCard>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={view}
          transition={{ duration: 0.6, delay: 0.05, ease }}
          className="relative h-full"
        >
          <span className="absolute right-6 top-6 z-10 rounded-full bg-[#00C9B1] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#080A0A]">
            Most Popular
          </span>
          <AnimatedBorderCard
            className="h-full"
            contentClassName="p-10"
            rotateDuration={3}
          >
            <h3 className="text-[22px] font-bold text-white">Pro</h3>
            <p className="mt-4 text-[28px] font-extrabold text-white">
              {yearly ? '$65 / year' : '$9 / month'}
            </p>
            <ul className="mt-8 space-y-3">
              <Feature>Everything in Free</Feature>
              <Feature>Unlimited auto-fills</Feature>
              <Feature>AI cover letter generation</Feature>
              <Feature>Application tracker dashboard</Feature>
              <Feature>Priority support</Feature>
              <Feature>Early access to new features</Feature>
            </ul>
            <a
              href="#cta"
              className="mt-10 flex w-full items-center justify-center rounded-full bg-[#00C9B1] py-3.5 text-[13px] font-bold text-[#080A0A] transition-opacity hover:opacity-90"
            >
              Start Free Trial
            </a>
          </AnimatedBorderCard>
        </motion.div>
      </div>
    </section>
  );
}
