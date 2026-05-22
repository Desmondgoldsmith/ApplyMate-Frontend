'use client';

import { Camera, Settings } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState } from 'react';

import {
  DEFAULT_HEADER_PREVIEW,
  type HeaderPreviewSettings,
  useCVEdit,
} from '@/components/cv/CVEditContext';
import { useToast } from '@/components/ui/Toast';
import { compressImageFileToCvDataUrl, CV_PHOTO_TOO_LARGE_USER_MESSAGE } from '@/lib/cvPhotoCompress';
import { cn } from '@/lib/utils';

function ToggleRow({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[11px] text-white/85">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors',
          on ? 'bg-[#00C9B1]' : 'bg-white/15',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
            on ? 'left-4' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function HeaderFloatingControls({ toolbarAlign = 'center' }: { toolbarAlign?: 'center' | 'end' }) {
  const ctx = useCVEdit();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const focused = ctx?.focusedSection === 'personal';
  const hp = ctx?.headerPreview ?? DEFAULT_HEADER_PREVIEW;
  const patch = ctx?.setHeaderPreview;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const set = (next: Partial<HeaderPreviewSettings>) => {
    patch?.(next);
  };

  const onPickPhoto = () => {
    fileRef.current?.click();
  };

  const onFile = (f: FileList | null) => {
    const file = f?.[0];
    if (!file || !ctx?.onUpdate) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error(CV_PHOTO_TOO_LARGE_USER_MESSAGE);
      return;
    }
    void (async () => {
      try {
        const url = await compressImageFileToCvDataUrl(file);
        ctx.onUpdate({
          personal: { ...ctx.data.personal, photoUrl: url },
        });
        set({ showPhoto: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : CV_PHOTO_TOO_LARGE_USER_MESSAGE;
        toast.error(msg);
      }
    })();
  };

  if (!ctx?.isEditing || !focused) return null;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files)}
      />

      <div
        className={cn(
          'relative z-50 mb-2 flex w-full shrink-0 pointer-events-auto',
          toolbarAlign === 'end' ? 'justify-end' : 'mx-auto justify-center',
        )}
      >
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#0C0F0F]/95 px-1.5 py-1 shadow-lg backdrop-blur-sm">
          <button
            type="button"
            title="Photo"
            className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-[#00C9B1]"
            onClick={(e) => {
              e.stopPropagation();
              onPickPhoto();
            }}
          >
            <Camera className="h-4 w-4" />
          </button>
          <button
            ref={btnRef}
            type="button"
            title="Header settings"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            className="rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-[#00C9B1]"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              ref={menuRef}
              id={menuId}
              role="menu"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'absolute top-full z-50 mt-2 w-[min(18rem,calc(100vw-2rem))] max-h-[400px] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.12] bg-[#141818] p-3 shadow-2xl',
                toolbarAlign === 'end' ? 'right-0 left-auto' : 'left-1/2 -translate-x-1/2',
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <ToggleRow label="Name" on={hp.showTitle} onToggle={() => set({ showTitle: !hp.showTitle })} />
              <ToggleRow
                label="Title / Headline"
                on={hp.showHeadline}
                onToggle={() => set({ showHeadline: !hp.showHeadline })}
              />
              <ToggleRow label="Phone" on={hp.showPhone} onToggle={() => set({ showPhone: !hp.showPhone })} />
              <ToggleRow label="LinkedIn" on={hp.showLinkedIn} onToggle={() => set({ showLinkedIn: !hp.showLinkedIn })} />
              <ToggleRow label="GitHub" on={hp.showGithub} onToggle={() => set({ showGithub: !hp.showGithub })} />
              <ToggleRow
                label="Website"
                on={hp.showWebsiteToggle}
                onToggle={() => set({ showWebsiteToggle: !hp.showWebsiteToggle })}
              />
              <ToggleRow
                label="Portfolio"
                on={hp.showPortfolioToggle}
                onToggle={() => set({ showPortfolioToggle: !hp.showPortfolioToggle })}
              />
              <ToggleRow label="Email" on={hp.showEmail} onToggle={() => set({ showEmail: !hp.showEmail })} />
              <ToggleRow label="Location" on={hp.showLocation} onToggle={() => set({ showLocation: !hp.showLocation })} />
              <ToggleRow label="Nationality" on={hp.nationality} onToggle={() => set({ nationality: !hp.nationality })} />
              <ToggleRow label="Date of Birth" on={hp.dateOfBirth} onToggle={() => set({ dateOfBirth: !hp.dateOfBirth })} />
              <ToggleRow label="Photo" on={hp.showPhoto} onToggle={() => set({ showPhoto: !hp.showPhoto })} />
              <ToggleRow label="Uppercase name" on={hp.uppercaseName} onToggle={() => set({ uppercaseName: !hp.uppercaseName })} />
              <ToggleRow label="Extra field" on={hp.extraField} onToggle={() => set({ extraField: !hp.extraField })} />

              <div className="my-2 border-t border-white/10" />

              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-white/35">Photo style</p>
              <div className="flex gap-1">
                {(['circle', 'square', 'avatar'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set({ photoStyle: s })}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-1 text-[10px] font-semibold capitalize transition',
                      hp.photoStyle === s
                        ? 'border-[#00C9B1] bg-[#00C9B1]/15 text-[#00C9B1]'
                        : 'border-white/10 text-white/45 hover:border-white/20',
                    )}
                  >
                    {s === 'avatar' ? 'Avatar' : s}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </>
  );
}
