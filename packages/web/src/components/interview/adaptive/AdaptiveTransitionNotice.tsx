'use client';

import { memo, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const DISPLAY_MS = 900;

export const AdaptiveTransitionNotice = memo(function AdaptiveTransitionNotice({
  message,
  className,
}: {
  message: string | null;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!message?.trim()) {
      setVisible(false);
      return;
    }
    setText(message.trim());
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), DISPLAY_MS);
    return () => window.clearTimeout(t);
  }, [message]);

  if (!text) return null;

  return (
    <p
      className={cn(
        'text-xs font-medium text-[var(--text-teal)] transition-opacity duration-300',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {text}
    </p>
  );
});
