'use client';

import { motion } from 'framer-motion';
import { Puzzle, Rocket, Zap } from 'lucide-react';
import type { ReactNode } from 'react';

import { AnimatedBorderCard } from './AnimatedBorderCard';
import { MatchScoreBar } from './MatchScoreBar';
import { TypingFormDemo } from './TypingFormDemo';

const view = { once: true, margin: '-80px' as const };
const ease = [0.21, 0.47, 0.32, 0.98] as const;

function StepCard({
  step,
  icon: Icon,
  title,
  description,
  children,
}: {
  step: string;
  icon: typeof Puzzle | typeof Zap | typeof Rocket;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={view}
      transition={{ duration: 0.6, ease }}
      className="h-full"
    >
      <AnimatedBorderCard className="h-full" contentClassName="relative overflow-hidden p-9">
        <div
          className="pointer-events-none absolute -right-[60px] -top-[60px] h-[160px] w-[160px] rounded-full opacity-[0.08]"
          style={{
            background:
              'radial-gradient(circle, #00C9B1 0%, transparent 70%)',
          }}
          aria-hidden
        />
        <p className="mb-4 text-[11px] font-bold uppercase tracking-[2px] text-[#00C9B1]">
          {step}
        </p>
        <Icon className="h-8 w-8 text-[#00C9B1]" strokeWidth={1.75} />
        <h3 className="mt-4 text-[20px] font-bold text-white">{title}</h3>
        <p className="mt-3 text-[15px] leading-[1.7] text-[rgba(255,255,255,0.5)]">
          {description}
        </p>
        <div className="mt-8">{children}</div>
      </AnimatedBorderCard>
    </motion.div>
  );
}

function BrowserToolbarMock() {
  return (
    <div className="rounded-xl border border-[rgba(0,201,177,0.15)] bg-[rgba(0,0,0,0.35)] p-3">
      <div className="flex h-9 items-center gap-2 rounded-lg bg-[rgba(255,255,255,0.04)] px-2">
        <div className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.15)]" />
        <div className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.15)]" />
        <div className="h-2 w-2 rounded-full bg-[rgba(255,255,255,0.15)]" />
        <div className="ml-2 flex flex-1 items-center gap-2 rounded-md bg-[rgba(255,255,255,0.06)] px-3 py-1.5">
          <span
            className="h-5 w-5 rounded bg-[#00C9B1]"
            style={{ boxShadow: '0 0 10px rgba(0,201,177,0.5)' }}
          />
          <span className="text-[11px] text-[rgba(255,255,255,0.35)]">
            chrome://extensions
          </span>
        </div>
      </div>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="px-4 py-[120px] sm:px-6 lg:px-[8%]"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={view}
        transition={{ duration: 0.6, ease }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[3px] text-[#00C9B1]">
          HOW IT WORKS
        </p>
        <h2 className="mt-4 max-w-[720px] text-[32px] font-extrabold tracking-[-1px] text-white sm:text-[42px]">
          From job post to submitted — in 60 seconds
        </h2>
      </motion.div>

      <div className="mt-16 grid gap-6 lg:grid-cols-3">
        <StepCard
          step="01"
          icon={Puzzle}
          title="Install & Import"
          description="Install the Chrome extension in seconds and upload your CV once. ApplyMate learns your skills, experience, and career goals."
        >
          <BrowserToolbarMock />
        </StepCard>

        <StepCard
          step="02"
          icon={Zap}
          title="Get Matched Instantly"
          description="Visit any job posting. ApplyMate instantly reads the description and shows your match score, skill gaps, and what the employer values most."
        >
          <div className="flex justify-center px-1">
            <MatchScoreBar score={87} label="Match Score" className="max-w-[280px]" />
          </div>
        </StepCard>

        <StepCard
          step="03"
          icon={Rocket}
          title="Apply in One Click"
          description="Click Apply. ApplyMate fills every field, generates a tailored cover letter, and uploads it — you just review and submit."
        >
          <TypingFormDemo />
        </StepCard>
      </div>
    </section>
  );
}
