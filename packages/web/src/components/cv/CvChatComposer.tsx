'use client';

import { Loader2, Send } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { CV_CHAT_INPUT_MAX_CHARS } from '@/lib/cv-chat-input.constants';
import { CV_CHAT_PASTE_HINT, formatCvChatCharCount } from '@/lib/cvChatInputDisplay';
import { cn } from '@/lib/utils';

export type CvChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  showPasteHint?: boolean;
  className?: string;
  textareaClassName?: string;
};

export function CvChatComposer({
  value,
  onChange,
  onSend,
  disabled = false,
  sending = false,
  placeholder = 'Type an answer or paste your full CV…',
  showPasteHint = true,
  className,
  textareaClassName,
}: CvChatComposerProps) {
  const trimmed = value.trim();
  const overLimit = value.length > CV_CHAT_INPUT_MAX_CHARS;
  const canSend = Boolean(trimmed) && !disabled && !sending && !overLimit;

  return (
    <div className={className}>
      {showPasteHint ? (
        <p className="mb-2 text-[11px] leading-snug text-white/45">{CV_CHAT_PASTE_HINT}</p>
      ) : null}
      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={placeholder}
          rows={4}
          disabled={disabled || sending}
          maxLength={CV_CHAT_INPUT_MAX_CHARS}
          data-lenis-prevent-wheel
          className={cn(
            'min-h-[96px] max-h-[min(50vh,480px)] min-w-0 flex-1 touch-pan-y resize-y overflow-y-auto rounded-xl border px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:ring-2 focus:ring-[#00C9B1]/40 disabled:opacity-50',
            overLimit
              ? 'border-rose-400/50 focus:ring-rose-400/30'
              : 'border-[rgba(255,255,255,0.10)] bg-[#111616]',
            textareaClassName,
          )}
        />
        <Button
          type="button"
          className="h-[52px] shrink-0 px-4"
          disabled={!canSend}
          onClick={onSend}
          aria-label="Send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p
        className={cn(
          'mt-1.5 text-right text-[11px]',
          overLimit ? 'text-rose-400/90' : 'text-white/40',
        )}
      >
        {formatCvChatCharCount(value.length)}
      </p>
    </div>
  );
}
