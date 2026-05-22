'use client';

import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { memo, type ReactNode } from 'react';

import { InterviewAvatar } from '@/components/interview/InterviewAvatar';
import { Button } from '@/components/ui/Button';
import { personaAvatarKey, type ResolvedInterviewPersona } from '@/lib/interviewPersonas';
import { cn } from '@/lib/utils';

export type InterviewScoringCelebrationPanelProps = {
  phase: 'submitting' | 'processing' | 'submit_retry_wait';
  interviewerName: string;
  thankYouMessage: string;
  sessionPersona?: ResolvedInterviewPersona | null;
  processingTitle?: string;
  processingDescription?: string;
  processingSteps?: string[];
  footer?: ReactNode;
  onLeaveToDashboard?: () => void;
  className?: string;
};

export const InterviewScoringCelebrationPanel = memo(function InterviewScoringCelebrationPanel({
  phase,
  interviewerName,
  thankYouMessage,
  sessionPersona,
  processingTitle,
  processingDescription,
  processingSteps,
  footer,
  onLeaveToDashboard,
  className,
}: InterviewScoringCelebrationPanelProps) {
  const isRetry = phase === 'submit_retry_wait';
  const isProcessing = phase === 'processing';

  return (
    <div
      className={cn(
        'absolute inset-0 z-20 flex flex-col items-center justify-center overflow-y-auto rounded-2xl bg-[#050909]/92 px-6 py-10 backdrop-blur-md',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        {sessionPersona ? (
          <div className="mb-4">
            <InterviewAvatar
              personality={personaAvatarKey(sessionPersona)}
              isSpeaking={false}
              isListening={false}
              size="md"
            />
          </div>
        ) : (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/40">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" aria-hidden />
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#00C9B1]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Interview complete
        </p>

        <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">
          {isRetry ? 'Hang tight — retrying submit' : `Thank you from ${interviewerName}`}
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-white/75 sm:text-[15px]">{thankYouMessage}</p>

        <div className="mt-5 w-full rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/[0.06] px-4 py-3.5 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#00C9B1]/90">
            What happens next
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-snug text-white/70">
            <li>· We&apos;re scoring your answers now — usually under a minute.</li>
            <li>
              · You can stay here, or head to your{' '}
              <span className="font-medium text-white">dashboard</span> and we&apos;ll alert you when
              results are ready.
            </li>
            <li>· Look for &quot;Interview results processing&quot; under Continue where you left off.</li>
          </ul>
        </div>

        {!isRetry ? (
          <div className="mt-6 flex w-full flex-col items-center gap-3">
            <Loader2 className="h-9 w-9 animate-spin text-[#00C9B1]" aria-hidden />
            <p className="text-base font-semibold text-white">
              {isProcessing
                ? processingTitle ?? 'Analysing your answers…'
                : 'Submitting your interview…'}
            </p>
            <p className="text-sm text-white/55">
              {isProcessing
                ? processingDescription ??
                  'Building your readiness score and personalised coaching.'
                : 'Saving your responses and starting background scoring.'}
            </p>
            {isProcessing && processingSteps && processingSteps.length > 0 ? (
              <ul className="mt-2 w-full space-y-2 text-left text-xs text-white/60">
                {processingSteps.map((step) => (
                  <li key={step} className="flex gap-2">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00C9B1]" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 text-sm text-amber-100/90">
            Temporary limit reached — we&apos;re retrying automatically to protect your answers.
          </p>
        )}

        <div className="mt-8 flex w-full max-w-sm flex-col gap-2">
          {onLeaveToDashboard ? (
            <Button type="button" variant="primary" className="w-full" onClick={onLeaveToDashboard}>
              Go to dashboard — we&apos;ll notify you
            </Button>
          ) : null}
          {footer ? <div className="w-full">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
});
