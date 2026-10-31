'use client';

import { memo, useEffect, useRef, useState } from 'react';

import { CvRichTextSpan } from '@/components/cv/CvRichTextSpan';
import {
  resolveSkillsFromCommaInput,
  richTextPlainText,
  skillLabelForCommaField,
} from '@/lib/cvRichTextCore';
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
  const [text, setText] = useState(() =>
    skills
      .map((s) => skillLabelForCommaField(s))
      .filter(Boolean)
      .join(', '),
  );
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setText(
        skills
          .map((s) => skillLabelForCommaField(s))
          .filter(Boolean)
          .join(', '),
      );
    }
  }, [skills]);

  const commit = (raw: string) => {
    const next = resolveSkillsFromCommaInput(raw, skills);
    onChange(next);
    setText(
      next
        .map((s) => skillLabelForCommaField(s))
        .filter(Boolean)
        .join(', '),
    );
  };

  return (
    <div>
      <label className="mb-1 block text-xs text-text-tertiary">{label}</label>
      <p className="mb-1.5 text-[10px] leading-snug text-text-disabled">
        {hint}
      </p>
      <input
        type="text"
        className={cn(
          'w-full rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none',
          'placeholder:text-text-tertiary focus:border-accent-border',
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
              className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2 py-0.5 text-[11px] text-accent-text"
            >
              <CvRichTextSpan html={s} className="text-accent-text" />
              <button
                type="button"
                className="text-text-tertiary hover:text-text-primary"
                onClick={() => onChange(skills.filter((x) => x !== s))}
                aria-label={`Remove ${skillLabelForCommaField(s)}`}
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
