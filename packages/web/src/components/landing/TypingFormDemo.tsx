'use client';

import { useEffect, useState } from 'react';

const fields = [
  { label: 'Name', value: 'Alex Morgan' },
  { label: 'Email', value: 'alex.morgan@email.com' },
  { label: 'Experience', value: 'Senior PM · 5 years' },
];

type TypingFormDemoProps = {
  showFillingLabel?: boolean;
  className?: string;
};

export function TypingFormDemo({
  showFillingLabel = false,
  className = '',
}: TypingFormDemoProps) {
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
      }, 38);
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
    <div className={className}>
      {showFillingLabel ? (
        <div className="mb-3 inline-flex rounded-full border border-[rgba(0,201,177,0.35)] bg-[rgba(0,201,177,0.1)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#00C9B1]">
          Filling…
        </div>
      ) : null}
      <div className="flex flex-col gap-2.5">
        {fields.map((f, i) => (
          <div
            key={f.label}
            className="rounded-lg border border-[rgba(0,201,177,0.25)] bg-[rgba(255,255,255,0.03)] px-3 py-2"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[rgba(255,255,255,0.25)]">
              {f.label}
            </div>
            <div className="mt-1 min-h-[20px] font-mono text-[12px] text-[rgba(255,255,255,0.75)]">
              {values[i]}
              {activeField === i && charIndex < f.value.length ? (
                <span className="animate-cursor ml-0.5 inline-block h-3 w-px translate-y-0.5 bg-[#00C9B1]" />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
