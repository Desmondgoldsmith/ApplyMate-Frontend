'use client';

import { Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export type CvAssistantClarificationEntry = {
  question: string;
  answer: string;
};

export type CvAssistantClarificationModalProps = {
  open: boolean;
  busy?: boolean;
  busyLabel?: string | null;
  currentQuestion: string | null;
  history?: CvAssistantClarificationEntry[];
  scopeHint?: string | null;
  onSubmit: (answer: string) => void | Promise<void>;
  onCancel: () => void;
  /** Override stacking (e.g. when hosted inside a very-high-z overlay). */
  layerZIndex?: number;
};

/**
 * Ready-made answers for users who are unsure what to type. Each fills the answer
 * box (editable) so the backend can act on a clear, natural-language instruction —
 * e.g. skip just this issue and proceed with the rest.
 */
const CLARIFICATION_QUICK_PROMPTS: { label: string; answer: string }[] = [
  {
    label: 'Skip this',
    answer:
      "Skip this particular item and continue applying the other improvements.",
  },
  {
    label: 'Use your best judgment',
    answer:
      'Use your best professional judgment and proceed with the most appropriate change.',
  },
  {
    label: 'Keep it factual',
    answer:
      "Only use information already in my resume. Don't invent or exaggerate anything.",
  },
];

export function CvAssistantClarificationModal({
  open,
  busy = false,
  busyLabel = null,
  currentQuestion,
  history = [],
  scopeHint = null,
  onSubmit,
  onCancel,
  layerZIndex,
}: CvAssistantClarificationModalProps) {
  const [answer, setAnswer] = useState('');

  useEffect(() => {
    if (!open) setAnswer('');
  }, [open, currentQuestion]);

  if (!open || !currentQuestion?.trim()) return null;

  const trimmedQuestion = currentQuestion.trim();
  const past = history.filter(
    (h) => h.question.trim().length > 0 && h.answer.trim().length > 0,
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'fixed inset-0 flex items-end justify-center bg-black/50 p-3 sm:items-center',
          layerZIndex == null && 'z-[130]',
        )}
        style={layerZIndex != null ? { zIndex: layerZIndex } : undefined}
        role="presentation"
        onClick={() => !busy && onCancel()}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cv-assistant-clarify-title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0C0F0F] shadow-[0_20px_48px_rgba(0,0,0,0.55)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p
              id="cv-assistant-clarify-title"
              className="text-sm font-semibold text-white/90"
            >
              Assistant needs a quick clarification
            </p>
            {scopeHint ? (
              <p className="mt-0.5 text-[11px] text-white/45">{scopeHint}</p>
            ) : null}
          </div>

          <div
            className="max-h-[min(50vh,360px)] space-y-3 overflow-y-auto overscroll-y-contain touch-pan-y px-4 py-3 [-webkit-overflow-scrolling:touch]"
            data-lenis-prevent-wheel
          >
            {past.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
                  Earlier in this request
                </p>
                {past.map((entry, i) => (
                  <div
                    key={`clarify-history-${i}`}
                    className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-2.5 text-xs"
                  >
                    <p className="font-medium text-white/55">Q</p>
                    <p className="mt-0.5 leading-relaxed text-white/75">
                      {entry.question}
                    </p>
                    <p className="mt-2 font-medium text-emerald-300/80">A</p>
                    <p className="mt-0.5 leading-relaxed text-white/80">
                      {entry.answer}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">
                Question
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/85">
                {trimmedQuestion}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                Not sure? Tap a quick reply
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CLARIFICATION_QUICK_PROMPTS.map((qp) => (
                  <button
                    key={qp.label}
                    type="button"
                    disabled={busy}
                    onClick={() => setAnswer(qp.answer)}
                    className="rounded-full border border-[#00C9B1]/30 bg-[#00C9B1]/10 px-2.5 py-1 text-[11px] font-medium text-[#7ef4e6] transition hover:border-[#00C9B1]/55 hover:bg-[#00C9B1]/15 disabled:opacity-50"
                  >
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-white/40">
                Your answer
              </span>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={3}
                disabled={busy}
                placeholder="Type your answer here, or tap a quick reply above…"
                className="w-full resize-y rounded-xl border border-white/[0.12] bg-[#111616] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-[#00C9B1]/35 disabled:opacity-60"
              />
            </label>

            {busy && busyLabel ? (
              <p className="flex items-center gap-2 text-[11px] text-white/50">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                {busyLabel}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              className="border border-white/10 text-xs"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-1.5 text-xs"
              disabled={busy || answer.trim().length === 0}
              onClick={() => void onSubmit(answer.trim())}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Send clarification
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
