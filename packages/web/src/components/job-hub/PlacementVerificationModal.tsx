'use client';

import { ImagePlus, Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';

export type VerificationUiStatus = 'none' | 'pending' | 'verified';

const PREMIUM_UNTIL_KEY = 'applymate:premium-active-until';
const MAX_SCREENSHOT_MB = 8;

export function readPremiumActiveUntil(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(PREMIUM_UNTIL_KEY);
  } catch {
    return null;
  }
}

export function writePremiumActiveUntil(iso: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (!iso) window.localStorage.removeItem(PREMIUM_UNTIL_KEY);
    else window.localStorage.setItem(PREMIUM_UNTIL_KEY, iso);
  } catch {
    /* ignore */
  }
}

export function PlacementVerificationModal({
  open,
  onOpenChange,
  jobId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId?: string | null;
  onSubmitted?: (result: { pending: boolean; premiumActiveUntil?: string | null }) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onScreenshotFile = (file: File | null) => {
    clearScreenshot();
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (PNG, JPG, or WebP)');
      return;
    }
    if (file.size > MAX_SCREENSHOT_MB * 1024 * 1024) {
      toast.error(`Image must be under ${MAX_SCREENSHOT_MB} MB`);
      return;
    }
    setScreenshotFile(file);
    setScreenshotUrl('');
    const reader = new FileReader();
    reader.onload = () => setScreenshotPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const submit = useMutation({
    mutationFn: () =>
      api.career.submitVerification({
        jobId: jobId?.trim() || undefined,
        linkedinPostUrl: linkedinUrl.trim(),
        screenshotUrl: screenshotUrl.trim() || undefined,
        screenshotFile: screenshotFile ?? undefined,
      }),
    onSuccess: (data) => {
      if (data.premiumActiveUntil) writePremiumActiveUntil(data.premiumActiveUntil);
      toast.success(
        data.verified
          ? '🎉 Congratulations! You’ve unlocked 5 days of Premium access.'
          : 'Submitted — we will review your verification shortly.',
      );
      onSubmitted?.({ pending: data.pendingApproval, premiumActiveUntil: data.premiumActiveUntil });
      void queryClient.invalidateQueries({ queryKey: ['career', 'dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      onOpenChange(false);
      setLinkedinUrl('');
      setScreenshotUrl('');
      clearScreenshot();
    },
    onError: (e) => toast.error(getApiErrorMessage(e) || 'Could not submit verification'),
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Verify your placement">
      <div className="space-y-4">
        <p className="text-[13px] leading-relaxed text-white/60">
          Share your social post about landing the role (LinkedIn or any platform). Upload a screenshot of
          your post, or paste a public image URL.
        </p>
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
            Post URL
          </span>
          <input
            value={linkedinUrl}
            onChange={(e) => setLinkedinUrl(e.target.value)}
            placeholder="https://www.linkedin.com/posts/… or any social link"
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00C9B1]/45"
          />
        </label>
        <div className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/40">
            Screenshot (optional)
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => onScreenshotFile(e.target.files?.[0] ?? null)}
          />
          {screenshotPreview ? (
            <div className="relative overflow-hidden rounded-lg border border-white/12">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshotPreview} alt="Screenshot preview" className="max-h-40 w-full object-contain bg-black/40" />
              <button
                type="button"
                onClick={clearScreenshot}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-[#0C0F0F]/90 text-white/70 hover:text-white"
                aria-label="Remove screenshot"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/[0.03] px-4 py-6 text-center transition hover:border-[#00C9B1]/40 hover:bg-[#00C9B1]/[0.04]"
            >
              <ImagePlus className="h-6 w-6 text-[#00C9B1]" aria-hidden />
              <span className="text-[13px] font-medium text-white/70">Upload screenshot</span>
              <span className="text-[11px] text-white/40">PNG, JPG, or WebP · max {MAX_SCREENSHOT_MB} MB</span>
            </button>
          )}
          <p className="text-[11px] text-white/35">Or paste an image URL:</p>
          <input
            value={screenshotUrl}
            onChange={(e) => {
              setScreenshotUrl(e.target.value);
              if (e.target.value.trim()) clearScreenshot();
            }}
            disabled={Boolean(screenshotFile)}
            placeholder="https://…"
            className="w-full rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-[#00C9B1]/45 disabled:opacity-50"
          />
        </div>
        <Button
          type="button"
          className="w-full gap-2"
          disabled={!linkedinUrl.trim() || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Submit verification
        </Button>
      </div>
    </Modal>
  );
}
