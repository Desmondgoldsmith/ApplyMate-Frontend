'use client';

import { Loader2, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

import { CvChatComposer } from '@/components/cv/CvChatComposer';
import { Button } from '@/components/ui/Button';
import { api, type ChatConversationHistoryItem, type ChatCreateCVPayload } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import type { CvTemplateId } from '@/lib/cvBuilder';
import {
  cvChatInputLimitErrorMessage,
  isCvChatInputOverLimit,
} from '@/lib/cvChatInputDisplay';
import { cn } from '@/lib/utils';

type Msg = ChatConversationHistoryItem;

const OPENING =
  "Let's build your CV together. Share your background or paste an existing CV — I'll only ask about what's still missing.";

function summarizeExtracted(d: ChatCreateCVPayload): string[] {
  const exp = Array.isArray(d.experience) ? d.experience.length : 0;
  const edu = Array.isArray(d.education) ? d.education.length : 0;
  const skills = Array.isArray(d.skills) ? d.skills.length : 0;
  const out: string[] = [];
  if (exp > 0) out.push(`${exp} experience entr${exp === 1 ? 'y' : 'ies'} ready`);
  if (edu > 0) out.push(`${edu} education entr${edu === 1 ? 'y' : 'ies'} ready`);
  if (skills > 0) out.push(`${skills} skills detected`);
  return out.length ? out : ['CV data captured'];
}

export type AIChatDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTemplate: CvTemplateId;
  onCreated: (profileId: string) => void;
};

export function AIChatDrawer({ open, onOpenChange, selectedTemplate, onCreated }: AIChatDrawerProps) {
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: OPENING }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [building, setBuilding] = useState(false);
  const [extractedData, setExtractedData] = useState<ChatCreateCVPayload | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setInput('');
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending, extractedData]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending || building) return;
    if (isCvChatInputOverLimit(text.length)) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: cvChatInputLimitErrorMessage(text.length),
        },
      ]);
      return;
    }
    const prior = [...messages];
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    try {
      const res = await api.cv.chatConversation({ message: text, history: prior });
      if (res.type === 'complete') {
        setExtractedData(res.extractedData);
      }
      setMessages((m) => [...m, { role: 'assistant', content: res.message }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: getApiErrorMessage(e) || 'I had trouble understanding that. Try again.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const progressLabel = useMemo(() => {
    const userTurns = messages.filter((m) => m.role === 'user').length;
    return `Turn ${Math.max(1, userTurns + 1)}`;
  }, [messages]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close build with AI"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="build-with-ai-title"
            initial={{ x: 380 }}
            animate={{ x: 0 }}
            exit={{ x: 380 }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="fixed right-0 top-0 z-[81] flex h-full w-[min(100vw,420px)] flex-col border-l border-white/[0.08] bg-[#0C0F0F] shadow-[-10px_0_40px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div>
                <h2 id="build-with-ai-title" className="text-sm font-semibold text-white">
                  Build with AI
                </h2>
                <p className="text-[11px] text-white/45">{progressLabel}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                onClick={() => onOpenChange(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="app-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
              {messages.map((m, idx) => (
                <div key={idx} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div
                    className={cn(
                      'max-w-[88%] rounded-[12px] px-3.5 py-2.5 text-sm text-white',
                      m.role === 'user'
                        ? 'rounded-br-[4px] border border-[rgba(0,201,177,0.35)] bg-[rgba(0,201,177,0.14)]'
                        : 'rounded-bl-[4px] border border-[rgba(0,201,177,0.16)] bg-[#111616]',
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sending ? (
                <div className="flex justify-start">
                  <div className="rounded-[12px] rounded-bl-[4px] border border-[rgba(0,201,177,0.16)] bg-[#111616] px-3.5 py-2.5 text-sm text-white/70">
                    AI is thinking...
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/[0.06] px-4 py-3">
              {extractedData ? (
                <div className="mb-3 rounded-lg border border-[rgba(16,185,129,0.35)] bg-[rgba(16,185,129,0.08)] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Ready to build</p>
                  <ul className="mt-2 space-y-1 text-xs text-white/75">
                    {summarizeExtracted(extractedData).map((line) => (
                      <li key={line}>- {line}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] text-white/40">Template: {selectedTemplate}</p>
                </div>
              ) : null}
              <CvChatComposer
                value={input}
                onChange={setInput}
                onSend={() => void send()}
                sending={sending}
                disabled={building}
                textareaClassName="border-white/[0.12] bg-[#111616]"
              />
              {extractedData ? (
                <Button
                  type="button"
                  className="mt-2 w-full gap-2"
                  disabled={building}
                  onClick={async () => {
                    if (!extractedData) return;
                    setBuilding(true);
                    try {
                      const { profileId } = await api.cv.chatCreateCV({
                        ...extractedData,
                        template: selectedTemplate,
                      });
                      onCreated(profileId);
                      onOpenChange(false);
                    } catch {
                      setMessages((m) => [...m, { role: 'assistant', content: 'Build failed. Please try again.' }]);
                    } finally {
                      setBuilding(false);
                    }
                  }}
                >
                  {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Build CV
                </Button>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

