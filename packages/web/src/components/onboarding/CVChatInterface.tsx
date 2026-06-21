'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CvChatComposer } from '@/components/cv/CvChatComposer';
import { Button } from '@/components/ui/Button';
import { GlowCard } from '@/components/ui/GlowCard';
import { api, type ChatConversationHistoryItem, type ChatCreateCVPayload } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { cvChatInputLimitErrorMessage, isCvChatInputOverLimit } from '@/lib/cvChatInputDisplay';
import { cn } from '@/lib/utils';

const OPENING =
  "Hi! I'm going to help you build a great resume. Share your background in your own words, or paste an existing resume. I'll only ask about what's still missing.";

const CHAT_HISTORY_STORAGE_KEY = 'applymate:onboarding:chat-history';

type ChatMessage = ChatConversationHistoryItem & {
  followUpQuestion?: string | null;
};

function loadStoredChatMessages(): ChatMessage[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        m != null &&
        typeof m === 'object' &&
        (m as ChatMessage).role != null &&
        typeof (m as ChatMessage).content === 'string',
    );
  } catch {
    return [];
  }
}

function AssistantMessageBody({
  content,
  followUpQuestion,
}: {
  content: string;
  followUpQuestion?: string | null;
}) {
  const question = followUpQuestion?.trim();
  if (!question) {
    return <>{content}</>;
  }
  return (
    <>
      {content ? <p className="leading-relaxed">{content}</p> : null}
      <p className={cn('font-medium text-[#00C9B1]', content ? 'mt-2' : '')}>{question}</p>
    </>
  );
}

function summarizeExtracted(d: ChatCreateCVPayload): { label: string }[] {
  const exp = Array.isArray(d.experience)
    ? d.experience.length
    : Array.isArray((d as { experiences?: unknown }).experiences)
      ? ((d as { experiences: unknown[] }).experiences?.length ?? 0)
      : 0;
  const edu = Array.isArray(d.education) ? d.education.length : 0;
  const projects = Array.isArray(d.projects) ? d.projects.length : 0;
  const skills =
    (Array.isArray(d.skills) ? d.skills.length : 0) +
    (Array.isArray((d as { primarySkills?: unknown }).primarySkills)
      ? ((d as { primarySkills: unknown[] }).primarySkills?.length ?? 0)
      : 0);
  const lines: { label: string }[] = [];
  if (exp > 0) lines.push({ label: `Found ${exp} experience ${exp === 1 ? 'entry' : 'entries'}` });
  if (edu > 0) lines.push({ label: 'Education detected' });
  if (projects > 0) lines.push({ label: `${projects} project${projects === 1 ? '' : 's'} captured` });
  if (skills > 0) lines.push({ label: `${skills} skills identified` });
  if (lines.length === 0) lines.push({ label: 'Resume data captured' });
  return lines;
}

function TypingOpening({ text, onDone }: { text: string; onDone: () => void }) {
  const [shown, setShown] = useState('');
  const doneRef = useRef(false);
  useEffect(() => {
    if (shown.length >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
      return;
    }
    const t = window.setTimeout(() => setShown(text.slice(0, shown.length + 1)), 16);
    return () => window.clearTimeout(t);
  }, [shown, text, onDone]);
  return <AssistantMessageBody content={shown} />;
}

export type CVChatInterfaceProps = {
  onComplete: (extractedData: ChatCreateCVPayload) => void;
  onSkip: () => void;
  selectedTemplate: string;
  /** Fires immediately when the AI finishes extracting data (before user clicks "Build"). */
  onDataExtracted?: (extractedData: ChatCreateCVPayload) => void;
};

export function CVChatInterface({ onComplete, onSkip, selectedTemplate, onDataExtracted }: CVChatInterfaceProps) {
  const stored = loadStoredChatMessages();
  const [openingDone, setOpeningDone] = useState(stored.length > 0);
  const [messages, setMessages] = useState<ChatMessage[]>(stored);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [extractedData, setExtractedData] = useState<ChatCreateCVPayload | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    if (messages.length === 0) {
      sessionStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(
      CHAT_HISTORY_STORAGE_KEY,
      JSON.stringify(messages.map(({ role, content }) => ({ role, content }))),
    );
  }, [messages]);

  useEffect(() => {
    if (openingDone && messages.length === 0) {
      setMessages([{ role: 'assistant', content: OPENING }]);
    }
  }, [openingDone, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, extractedData]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isTyping || !openingDone) return;
    if (isCvChatInputOverLimit(trimmed.length)) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: cvChatInputLimitErrorMessage(trimmed.length),
        },
      ]);
      return;
    }
    const prior = messages;
    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const nextMessages = [...prior, userMessage];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);
    try {
      const history: ChatConversationHistoryItem[] = prior.map(({ role, content }) => ({ role, content }));
      const response = await api.cv.chatConversation({
        message: trimmed,
        history,
      });
      setIsTyping(false);
      if (response.type === 'complete') {
        setExtractedData(response.extractedData);
        onDataExtracted?.(response.extractedData);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.message,
            followUpQuestion: response.followUpQuestion,
          },
        ]);
      } else if (response.type === 'validation_error') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.message,
            followUpQuestion: response.followUpQuestion,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.message,
            followUpQuestion: response.followUpQuestion,
          },
        ]);
      }
    } catch (e) {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: getApiErrorMessage(e) || 'Sorry, I had trouble processing that. Can you try again?',
        },
      ]);
    }
  }, [input, isTyping, messages, onDataExtracted, openingDone]);

  const onOpeningComplete = useCallback(() => setOpeningDone(true), []);

  return (
    <GlowCard className="min-h-0 border border-[rgba(0,201,177,0.15)]" contentClassName="flex min-h-0 min-w-0 flex-col p-0">
      <div className="border-b border-[rgba(0,201,177,0.12)] px-4 py-3">
        <p className="text-center text-[11px] leading-snug text-white/45">
          Answer naturally or paste your full resume. Follow-ups focus on gaps only.
        </p>
      </div>

      <div
        ref={scrollRef}
        data-lenis-prevent-wheel
        className="app-scrollbar max-h-[min(52vh,420px)] min-h-0 touch-pan-y space-y-3 overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch]"
      >
        {!openingDone ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-[12px] rounded-bl-[4px] border border-[rgba(0,201,177,0.15)] bg-[#111616] px-4 py-3 text-sm text-white">
              <TypingOpening text={OPENING} onDone={onOpeningComplete} />
            </div>
          </div>
        ) : null}

        {openingDone
          ? messages.map((m, idx) => (
              <div key={idx} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] px-4 py-3 text-sm text-white',
                    m.role === 'user'
                      ? 'rounded-[12px] rounded-br-[4px] border border-[rgba(0,201,177,0.3)] bg-[rgba(0,201,177,0.15)]'
                      : 'rounded-[12px] rounded-bl-[4px] border border-[rgba(0,201,177,0.15)] bg-[#111616]',
                  )}
                >
                  {m.role === 'assistant' ? (
                    <AssistantMessageBody content={m.content} followUpQuestion={m.followUpQuestion} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))
          : null}

        {isTyping ? (
          <div className="flex justify-start">
            <div className="flex max-w-[85%] items-center gap-2 rounded-[12px] rounded-bl-[4px] border border-[rgba(0,201,177,0.15)] bg-[#111616] px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-2 w-2 rounded-full bg-[#00C9B1]"
                    animate={{ opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {extractedData ? (
        <div className="border-t border-[rgba(0,201,177,0.12)] bg-[#0C0F0F] px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#00C9B1]">Ready to build</p>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {summarizeExtracted(extractedData).map((line) => (
              <li key={line.label} className="flex items-center gap-2">
                <span className="text-[#22C55E]">✓</span> {line.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-white/35">Template: {selectedTemplate}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" className="gap-1" onClick={() => onComplete({ ...extractedData, template: selectedTemplate })}>
              ✨ Build my resume now →
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="border border-white/10"
              onClick={() => {
                setExtractedData(null);
                setMessages((m) => [
                  ...m,
                  { role: 'assistant', content: 'Sure. Tell me anything else you want on your resume.' },
                ]);
              }}
            >
              Keep chatting
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t border-[rgba(0,201,177,0.12)] p-4">
          <CvChatComposer
            value={input}
            onChange={setInput}
            onSend={() => void sendMessage()}
            disabled={!openingDone}
            sending={isTyping}
          />
          <button
            type="button"
            className="mt-3 w-full text-center text-[13px] text-white/45 transition hover:text-white/75"
            onClick={onSkip}
          >
            Skip chat →
          </button>
        </div>
      )}
    </GlowCard>
  );
}
