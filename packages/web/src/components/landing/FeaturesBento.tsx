'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { AnimatedBorderCard } from './AnimatedBorderCard';
import { BentoTypingForm } from './BentoTypingForm';
import { MatchScoreBar } from './MatchScoreBar';

const view = { once: true, margin: '-80px' as const };
const ease = [0.21, 0.47, 0.32, 0.98] as const;

function TileTitle({ bold, rest }: { bold: string; rest: string }) {
  return (
    <p className="max-w-xl text-[15px] font-semibold leading-snug text-white">
      <strong>{bold}</strong>{' '}
      <span className="font-normal text-[rgba(255,255,255,0.45)]">{rest}</span>
    </p>
  );
}

function CornerGlow({
  position,
  gradient,
}: {
  position: 'tr' | 'tl' | 'tc';
  gradient?: string;
}) {
  const pos =
    position === 'tr'
      ? '-right-16 -top-16'
      : position === 'tl'
        ? '-left-16 -top-16'
        : 'left-1/2 -top-20 -translate-x-1/2';
  return (
    <div
      className={`bento-corner-glow absolute ${pos}`}
      style={
        gradient
          ? {
              background: gradient,
            }
          : undefined
      }
      aria-hidden
    />
  );
}

function BentoTile({
  index,
  colSpan,
  corner,
  cornerGradient,
  children,
}: {
  index: number;
  colSpan: string;
  corner: 'tr' | 'tl' | 'tc';
  cornerGradient?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      className={`group min-h-[320px] ${colSpan}`}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1, ease }}
      viewport={view}
    >
      <AnimatedBorderCard radiusPx={0} className="h-full min-h-[320px]">
        <CornerGlow position={corner} gradient={cornerGradient} />
        {children}
      </AnimatedBorderCard>
    </motion.div>
  );
}

const boardRows = [
  [
    { name: 'LinkedIn', dot: '#0A66C2' },
    { name: 'Indeed', dot: '#2557A7' },
    { name: 'Glassdoor', dot: '#0CAA41' },
  ],
  [
    { name: 'Greenhouse', dot: '#24A47F' },
    { name: 'Lever', dot: '#6B4EE6' },
    { name: 'Workday', dot: '#00C9B1' },
  ],
];

export function FeaturesBento() {
  return (
    <section
      id="features"
      className="px-4 pb-[120px] pt-0 sm:px-6 lg:px-[8%]"
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        viewport={view}
      >
        <p className="text-[11px] font-bold uppercase tracking-[3px] text-[#00C9B1]">
          FEATURES
        </p>
        <h2 className="mt-4 max-w-[720px] text-[32px] font-extrabold tracking-[-1px] text-white sm:text-[42px]">
          Everything you need to land the job
        </h2>
      </motion.div>

      <div
        className="mt-14 grid grid-cols-1 gap-0.5 overflow-hidden rounded-[24px] border border-[rgba(0,201,177,0.08)] md:grid-cols-3"
      >
        <BentoTile index={0} colSpan="md:col-span-2" corner="tr">
          <div className="flex h-full min-h-[318px] flex-col px-8 pb-0 pt-8">
            <TileTitle
              bold="CV Match Score."
              rest="See exactly how well you fit before you apply."
            />
            <div className="relative z-[1] mt-auto w-full max-w-lg flex-1 pt-10 pb-8">
              <div
                className="pointer-events-none absolute -right-8 -top-4 h-[200px] w-[200px] rounded-full opacity-100"
                style={{
                  background:
                    'radial-gradient(circle, rgba(0,201,177,0.12) 0%, transparent 70%)',
                }}
                aria-hidden
              />
              <MatchScoreBar
                score={87}
                label="CV Match Score"
                skills={[
                  { name: 'React', matched: true },
                  { name: 'TypeScript', matched: true },
                  { name: 'Node.js', matched: true },
                  { name: 'DevOps', matched: false },
                ]}
              />
            </div>
          </div>
        </BentoTile>

        <BentoTile index={1} colSpan="md:col-span-1" corner="tl">
          <div className="flex h-full min-h-[318px] flex-col px-8 pb-0 pt-8">
            <TileTitle
              bold="Auto Form Fill."
              rest="One click populates every field instantly."
            />
            <div className="relative mt-auto flex flex-1 items-end justify-center overflow-visible pb-4 pt-12">
              <div className="scale-110">
                <BentoTypingForm />
              </div>
            </div>
          </div>
        </BentoTile>

        <BentoTile
          index={2}
          colSpan="md:col-span-1"
          corner="tr"
          cornerGradient="radial-gradient(circle, rgba(0,212,212,0.05), transparent 70%)"
        >
          <div className="flex h-full min-h-[318px] flex-col px-8 pb-0 pt-8">
            <TileTitle
              bold="Works Everywhere."
              rest="Every major job board, automatically."
            />
            <div
              className="relative mt-auto flex flex-1 flex-col items-center justify-end gap-3 pb-6 pt-10"
              style={{
                maskImage:
                  'linear-gradient(to bottom, black 55%, transparent 100%)',
                WebkitMaskImage:
                  'linear-gradient(to bottom, black 55%, transparent 100%)',
              }}
            >
              {boardRows.map((row) => (
                <div
                  key={row.map((x) => x.name).join()}
                  className="flex flex-wrap justify-center gap-2"
                >
                  {row.map((b) => (
                    <span
                      key={b.name}
                      className="inline-flex items-center rounded-full border border-[rgba(0,201,177,0.18)] bg-[rgba(0,201,177,0.06)] px-3 py-1.5 text-[12px] text-[rgba(255,255,255,0.6)]"
                    >
                      <span
                        className="mr-2 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: b.dot }}
                      />
                      {b.name}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </BentoTile>

        <BentoTile
          index={3}
          colSpan="md:col-span-2"
          corner="tl"
          cornerGradient="radial-gradient(circle, rgba(0,200,185,0.07), rgba(0,165,150,0.05), transparent 70%)"
        >
          <div className="flex h-full min-h-[318px] flex-col px-8 pb-0 pt-8">
            <TileTitle
              bold="Cover Letter AI."
              rest="A tailored letter generated in 3 seconds."
            />
            <div className="relative mt-auto flex flex-1 items-end justify-center overflow-visible pb-6 pt-12">
              <div
                className="pointer-events-none absolute bottom-8 left-1/2 h-40 w-[80%] -translate-x-1/2 rounded-full opacity-70"
                style={{
                  background:
                    'radial-gradient(ellipse, rgba(0,201,177,0.06), transparent 70%)',
                }}
                aria-hidden
              />
              <div
                className="relative z-[1] w-full max-w-md rounded-lg border border-[rgba(255,255,255,0.06)] px-6 py-5 shadow-xl"
                style={{
                  transform: 'rotate(1deg)',
                  background:
                    'linear-gradient(135deg, #141818, #0f1313)',
                }}
              >
                <div className="text-[11px] text-[rgba(255,255,255,0.25)]">
                  Cover Letter
                </div>
                <div className="mt-1 text-[10px] text-[rgba(255,255,255,0.15)]">
                  {new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div className="mt-4 space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-2 rounded-full bg-[rgba(255,255,255,0.06)]"
                      style={{
                        width: `${88 - i * 7}%`,
                        filter: 'blur(2px)',
                        opacity: 0.4,
                      }}
                    />
                  ))}
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[#00C9B1]">
                  ...my experience with React and TypeScript directly aligns
                  with...
                </p>
                <div className="mt-4 inline-flex rounded-full border border-[rgba(0,201,177,0.25)] bg-[rgba(0,201,177,0.08)] px-2.5 py-1 text-[10px] font-medium text-[rgba(255,255,255,0.5)]">
                  Generated by ApplyMate ✦
                </div>
              </div>
            </div>
          </div>
        </BentoTile>

        <BentoTile index={4} colSpan="md:col-span-1" corner="tr">
          <div className="flex h-full min-h-[318px] flex-col px-8 pb-0 pt-8">
            <TileTitle
              bold="Application Tracker."
              rest="Never lose track of where you stand."
            />
            {/* Same pattern as Form Fill / job pills: anchor mock to bottom; full tile width = even columns */}
            <div className="relative mt-auto flex min-h-0 w-full flex-1 flex-col justify-end pb-6 pt-10">
              <div
                className="grid w-full grid-cols-3 gap-2 sm:gap-2.5"
                style={{
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                }}
              >
                {[
                  {
                    title: 'Applied',
                    cards: ['Stripe', 'Notion'],
                    accent: 'rgba(255,255,255,0.14)' as const,
                    glow: false,
                  },
                  {
                    title: 'Interview',
                    cards: ['Airbnb'],
                    accent: '#00C9B1' as const,
                    glow: true,
                  },
                  {
                    title: 'Offer',
                    cards: ['Linear'],
                    accent: '#22C55E' as const,
                    glow: false,
                  },
                ].map((col) => (
                  <div
                    key={col.title}
                    className="flex min-h-0 flex-col rounded-xl border border-[rgba(0,201,177,0.16)] bg-[rgba(0,0,0,0.5)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-2.5"
                  >
                    <div className="shrink-0 border-b border-[rgba(255,255,255,0.06)] pb-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(255,255,255,0.42)] sm:text-[11px]">
                        {col.title}
                      </span>
                    </div>
                    <ul className="mt-2 flex min-h-0 flex-col gap-1.5 sm:gap-2">
                      {col.cards.map((c) => (
                        <li
                          key={c}
                          className={`list-none rounded-md border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.045)] py-2 pl-2.5 pr-2 text-[11px] font-semibold leading-snug text-[rgba(255,255,255,0.78)] sm:py-2.5 sm:pl-3 sm:text-[12px] ${
                            col.glow
                              ? 'shadow-[0_0_14px_rgba(0,201,177,0.08)]'
                              : ''
                          }`}
                          style={{
                            borderLeftWidth: 3,
                            borderLeftColor: col.accent,
                          }}
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </BentoTile>

        <BentoTile index={5} colSpan="md:col-span-1" corner="tc">
          <div className="flex h-full min-h-[318px] flex-col px-8 pb-0 pt-8">
            <TileTitle
              bold="Keyboard Shortcut."
              rest="Trigger ApplyMate without lifting your hands."
            />
            <div className="mt-auto flex flex-1 items-end justify-center gap-3 pb-10 pt-12">
              {[
                { k: '⌘', cls: 'bento-key-glow' },
                { k: '⇧', cls: 'bento-key-glow bento-key-glow-delay-1' },
                { k: 'A', cls: 'bento-key-glow bento-key-glow-delay-2' },
              ].map((key) => (
                <div
                  key={key.k}
                  className={`flex h-[52px] w-[52px] items-center justify-center rounded-[10px] border border-[rgba(0,201,177,0.25)] text-lg font-semibold text-white ${key.cls}`}
                  style={{
                    background: 'linear-gradient(145deg, #1a2020, #111616)',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.5)',
                  }}
                >
                  {key.k}
                </div>
              ))}
            </div>
          </div>
        </BentoTile>
      </div>
    </section>
  );
}
