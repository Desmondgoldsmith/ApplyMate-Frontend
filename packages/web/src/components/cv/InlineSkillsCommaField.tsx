'use client';

import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  resolveSkillsFromCommaInput,
  skillLabelForCommaField,
} from '@/lib/cvRichTextCore';
import { cn } from '@/lib/utils';

function joinSkills(skills: string[]): string {
  return skills
    .map((s) => skillLabelForCommaField(s))
    .filter(Boolean)
    .join(', ');
}

/**
 * One comma-separated skills field for inline CV editing. It wraps and grows like the printed
 * line and uses the template's font, so editing never truncates or resizes the skills.
 */
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
  const [text, setText] = useState(() => joinSkills(skills));
  const focusedRef = useRef(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!focusedRef.current) setText(joinSkills(skills));
  }, [skills]);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const commit = (raw: string) => {
    const next = resolveSkillsFromCommaInput(raw, skills);
    onChange(next);
    setText(joinSkills(next));
  };

  return (
    <textarea
      ref={areaRef}
      rows={1}
      className={cn(
        'block w-full min-w-0 resize-none overflow-hidden rounded-sm border-0 bg-transparent p-0 text-inherit outline-none [font:inherit] [letter-spacing:inherit]',
        'shadow-[inset_0_-1px_0_0_rgba(23,178,106,0.55)]',
        placeholderTone === 'onDark'
          ? 'placeholder:text-white/45'
          : 'placeholder:text-black/40',
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
      onChange={(e) => setText(e.target.value.replace(/\n/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          focusedRef.current = false;
          commit(text);
          e.currentTarget.blur();
        }
      }}
    />
  );
});
