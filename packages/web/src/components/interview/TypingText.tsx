'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';

import { cn } from '@/lib/utils';

function activeWordIndex(text: string, charIndex?: number): number {
  if (charIndex == null || charIndex < 0) return -1;
  const words = text.match(/\S+/g);
  if (!words) return -1;
  let cursor = 0;
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i]!;
    const start = text.indexOf(w, cursor);
    if (start === -1) continue;
    const end = start + w.length;
    if (charIndex >= start && charIndex <= end) return i;
    cursor = end;
  }
  return -1;
}

export function TypingText({
  text,
  isActive,
  charIndex,
  className,
}: {
  text: string;
  isActive: boolean;
  charIndex?: number;
  className?: string;
}) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const wordIdx = useMemo(() => activeWordIndex(text, charIndex), [charIndex, text]);

  if (!text.trim()) return null;

  let seenWord = -1;
  return (
    <motion.p
      key={text}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className={cn('text-base leading-relaxed text-white', className)}
    >
      {tokens.map((token, idx) => {
        if (!token.trim()) return <span key={`s-${idx}`}>{token}</span>;
        seenWord += 1;
        if (!isActive || wordIdx < 0) return <span key={`w-${idx}`}>{token}</span>;
        const active = seenWord === wordIdx;
        const spoken = seenWord < wordIdx;
        return (
          <span
            key={`w-${idx}`}
            className={cn(active ? 'font-medium text-white' : spoken ? 'text-white/80' : 'text-white/50')}
          >
            {token}
          </span>
        );
      })}
    </motion.p>
  );
}
