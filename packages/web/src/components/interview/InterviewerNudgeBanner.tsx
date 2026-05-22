'use client';

import { memo } from 'react';

import type { ResolvedInterviewPersona } from '@/lib/interviewPersonas';
import { cn } from '@/lib/utils';

export const InterviewerNudgeBanner = memo(function InterviewerNudgeBanner({
  persona,
  message,
  className,
}: {
  persona: ResolvedInterviewPersona;
  message: string;
  className?: string;
}) {
  if (!persona.showMidSessionFeedback || !message.trim()) return null;

  return (
    <aside
      className={cn('rounded-xl border px-3 py-2.5 text-sm', persona.theme.nudgeClass, className)}
      role="status"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: persona.accentColor }}>
        {persona.personName}
      </p>
      <p className="mt-0.5 leading-relaxed text-white/90">{message}</p>
    </aside>
  );
});
