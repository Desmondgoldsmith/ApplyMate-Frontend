'use client';

import { useEffect, useState } from 'react';

const fields = [
  { label: 'Full Name', value: 'John Adebayo' },
  { label: 'Email', value: 'john@email.com' },
  { label: 'Experience', value: '5 years' },
];

export function BentoTypingForm() {
  const [values, setValues] = useState<string[]>(['', '', '']);
  const [activeField, setActiveField] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    const full = fields[activeField].value;
    if (charIndex < full.length) {
      const id = window.setTimeout(() => {
        setValues((prev) => {
          const next = [...prev];
          next[activeField] = full.slice(0, charIndex + 1);
          return next;
        });
        setCharIndex((c) => c + 1);
      }, 42);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => {
      if (activeField < fields.length - 1) {
        setActiveField((f) => f + 1);
        setCharIndex(0);
      } else {
        setActiveField(0);
        setCharIndex(0);
        setValues(['', '', '']);
      }
    }, 900);
    return () => window.clearTimeout(id);
  }, [activeField, charIndex]);

  return (
    <div
      className="relative rounded-xl border border-[rgba(0,201,177,0.12)] bg-[rgba(0,0,0,0.45)] p-4 shadow-[0_20px_60px_rgba(0,201,177,0.08)]"
      style={{
        transform: 'rotate(-2deg)',
      }}
    >
      <div
        className="pointer-events-none absolute -bottom-6 left-1/2 h-32 w-[90%] -translate-x-1/2 rounded-full opacity-40"
        style={{
          background:
            'radial-gradient(ellipse, rgba(0,201,177,0.2), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative">
        <div className="mb-3 inline-flex rounded-full border border-[rgba(0,201,177,0.35)] bg-[rgba(0,201,177,0.1)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#00C9B1]">
          Filling…
        </div>
        <div className="flex flex-col gap-2.5">
          {fields.map((f, i) => (
            <div
              key={f.label}
              className="rounded-lg border-l-2 border-[#00C9B1] bg-[rgba(255,255,255,0.04)] px-3 py-2"
            >
              <div className="flex flex-wrap items-baseline gap-x-1 text-[12px]">
                <span className="font-semibold text-[rgba(255,255,255,0.4)]">
                  {f.label}
                </span>
                <span className="text-[rgba(255,255,255,0.25)]">→</span>
                <span className="font-mono text-[rgba(255,255,255,0.85)]">
                  {values[i]}
                  {activeField === i && charIndex < f.value.length ? (
                    <span className="animate-cursor ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-[#00C9B1]" />
                  ) : null}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
