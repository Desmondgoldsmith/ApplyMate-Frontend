'use client';

import { memo, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

/** Comma-separated skills field — commas stay visible while typing; commits on blur. */
export const CategorySkillsInput = memo(function CategorySkillsInput({
  skills,
  onChange,
  onFocus,
  label = 'Skills',
  hint = 'Type skills separated by commas (e.g. React, Node.js, Docker).',
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
  onFocus?: () => void;
  label?: string;
  hint?: string;
}) {
  const [text, setText] = useState(() => skills.join(', '));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setText(skills.join(', '));
    }
  }, [skills]);

  const commit = (raw: string) => {
    const next = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(next);
    setText(next.join(', '));
  };

  return (
    <div>
      <label className="mb-1 block text-xs text-white/45">{label}</label>
      <p className="mb-1.5 text-[10px] leading-snug text-white/30">{hint}</p>
      <input
        type="text"
        className={cn(
          'w-full rounded-lg border border-[rgba(255,255,255,0.10)] bg-[#0c1010] px-3 py-2 text-sm text-white outline-none',
          'placeholder:text-white/30 focus:border-[#00C9B1]/50',
        )}
        value={text}
        placeholder="e.g. React, TypeScript, AWS"
        onFocus={() => {
          focusedRef.current = true;
          onFocus?.();
        }}
        onBlur={() => {
          focusedRef.current = false;
          commit(text);
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            focusedRef.current = false;
            commit(text);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {skills.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {skills.map((s, i) => (
            <span
              key={`${s}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-[#00C9B1]/15 px-2 py-0.5 text-[11px] text-[#00C9B1]"
            >
              {s}
              <button
                type="button"
                className="text-white/50 hover:text-white"
                onClick={() => onChange(skills.filter((x) => x !== s))}
                aria-label={`Remove ${s}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
});
