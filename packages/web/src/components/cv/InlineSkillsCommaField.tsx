'use client';

import { memo, useEffect, useRef, useState } from 'react';

import {
  resolveSkillsFromCommaInput,
  skillLabelForCommaField,
} from '@/lib/cvRichTextCore';
import { cn } from '@/lib/utils';

/** One wide comma-separated skills field for inline CV preview editing. */
export const InlineSkillsCommaField = memo(function InlineSkillsCommaField({
  skills,
  onChange,
  onFocus,
  className,
  placeholder = 'e.g. React, TypeScript, AWS — separate with commas',
  placeholderTone = 'default',
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
  onFocus?: () => void;
  className?: string;
  placeholder?: string;
  placeholderTone?: 'default' | 'onDark';
}) {
  const [text, setText] = useState(() =>
    skills.map((s) => skillLabelForCommaField(s)).filter(Boolean).join(', '),
  );
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setText(skills.map((s) => skillLabelForCommaField(s)).filter(Boolean).join(', '));
    }
  }, [skills]);

  const commit = (raw: string) => {
    const next = resolveSkillsFromCommaInput(raw, skills);
    onChange(next);
    setText(next.map((s) => skillLabelForCommaField(s)).filter(Boolean).join(', '));
  };

  return (
    <input
      type="text"
      className={cn(
        'block w-full min-w-0 rounded-sm border-0 border-b border-[rgba(0,174,175,0.5)] bg-transparent px-0 py-0.5 text-inherit outline-none',
        placeholderTone === 'onDark' ? 'placeholder:text-white/45' : 'placeholder:text-black/40',
        className,
      )}
      value={text}
      placeholder={placeholder}
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
  );
});
