'use client';

import confetti from 'canvas-confetti';
import { Copy, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { CareerBadge } from '@/lib/career';
import { resolveLinkedInOpenUrl } from '@/lib/linkedinShare';

const DEFAULT_SHARE = 'I just got a job using ApplyMate 🚀';
const X_INTENT_BASE = 'https://twitter.com/intent/tweet';

function fireShareConfetti() {
  void confetti({
    particleCount: 70,
    spread: 65,
    origin: { y: 0.45 },
    colors: ['#00C9B1', '#ffffff', '#F59E0B', '#00A896'],
  });
  window.setTimeout(() => {
    void confetti({
      particleCount: 45,
      spread: 50,
      origin: { y: 0.55 },
      colors: ['#00C9B1', '#F59E0B'],
    });
  }, 220);
}

function openInNewTab(url: string): boolean {
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  return opened != null;
}

export function ShareAchievementModal({
  open,
  onOpenChange,
  badge,
  jobTitle,
  company,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badge?: CareerBadge | null;
  jobTitle?: string;
  company?: string;
}) {
  const toast = useToast();
  const shareText = useMemo(() => {
    const base = badge?.shareText?.trim() || DEFAULT_SHARE;
    if (jobTitle?.trim() && company?.trim()) {
      return `${base}\n\n${jobTitle} at ${company}`;
    }
    return base;
  }, [badge?.shareText, jobTitle, company]);

  useEffect(() => {
    if (!open) return;
    fireShareConfetti();
  }, [open]);

  const copyText = useCallback(() => {
    void navigator.clipboard.writeText(shareText).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Could not copy'),
    );
  }, [shareText, toast]);

  const copyThenOpen = useCallback(
    (url: string, platformLabel: string) => {
      void navigator.clipboard.writeText(shareText).then(
        () => {
          if (!openInNewTab(url)) {
            toast.error('Pop-up blocked — allow new tabs, then try again');
            return;
          }
          toast.success(`Copied — paste into your ${platformLabel} post`);
        },
        () => {
          if (!openInNewTab(url)) {
            toast.error('Pop-up blocked — allow new tabs, then try again');
            return;
          }
          toast.error(`Could not copy — paste manually on ${platformLabel}`);
        },
      );
    },
    [shareText, toast],
  );

  const openLinkedIn = useCallback(() => {
    const url =
      resolveLinkedInOpenUrl(shareText, badge?.shareLink) ?? 'https://www.linkedin.com/feed/';
    copyThenOpen(url, 'LinkedIn');
  }, [badge?.shareLink, copyThenOpen, shareText]);

  const openX = useCallback(() => {
    const url = `${X_INTENT_BASE}?text=${encodeURIComponent(shareText)}`;
    copyThenOpen(url, 'X');
  }, [copyThenOpen, shareText]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Share your win">
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/15 to-[#00C9B1]/10 p-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/90">
            {badge?.title ?? 'Job accepted'}
          </p>
          <p className="mt-2 text-2xl" aria-hidden>
            🏆
          </p>
          {badge?.description ? (
            <p className="mt-2 text-[13px] text-white/65">{badge.description}</p>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-white/70">{shareText}</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1 gap-2" onClick={copyText}>
            <Copy className="h-4 w-4" />
            Copy text
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 gap-2 border border-[#0A66C2]/40 text-[#7eb8ff]"
            onClick={openLinkedIn}
          >
            <ExternalLink className="h-4 w-4" />
            Open LinkedIn
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="flex-1 gap-2 border border-white/15 text-white/75"
            onClick={openX}
          >
            <ExternalLink className="h-4 w-4" />
            Open X
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-white/40">
          We copy your message first, then open the site in a new tab. Paste into LinkedIn, X, Instagram,
          WhatsApp, or any platform you use — we never post on your behalf.
        </p>
      </div>
    </Modal>
  );
}
