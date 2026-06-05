'use client';

import {
  FileSearch,
  FileText,
  LayoutTemplate,
  ListPlus,
  Loader2,
  MoreHorizontal,
  Rows3,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useRunCvDetailedScore } from '@/hooks/useRunCvDetailedScore';
import { api } from '@/lib/api';
import { getApiErrorMessage } from '@/lib/axios';
import { cvSuggestionsQueryKey } from '@/lib/cvSuggestionsQuery';
import { cn } from '@/lib/utils';

const MENU_MIN_PX = 192;
const MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-white/85 transition hover:bg-white/[0.04]';

type CvTopChromeMoreMenuProps = {
  targetId: string;
  spellChecking: boolean;
  onOpenTemplatePicker: () => void;
  onOpenSectionModal: () => void;
  onOpenSectionOrder?: () => void;
  onOpenAiChat: () => void;
  onTriggerSpellCheck: () => void;
  /** When false, hides “Build with AI” from the overflow menu (e.g. onboarding). */
  showBuildWithAi?: boolean;
  /** Expand menu inline (for mobile bottom sheets) instead of a fixed portal dropdown. */
  inlineMenu?: boolean;
};

export function CvTopChromeMoreMenu({
  targetId,
  spellChecking,
  onOpenTemplatePicker,
  onOpenSectionModal,
  onOpenSectionOrder,
  onOpenAiChat,
  onTriggerSpellCheck,
  showBuildWithAi = true,
  inlineMenu = false,
}: CvTopChromeMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null,
  );
  const runScan = useRunCvDetailedScore();
  const queryClient = useQueryClient();
  const toast = useToast();

  const closeAnd = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const navItems: Array<{
    id: string;
    label: string;
    Icon: LucideIcon;
    onSelect: () => void;
  }> = [
    {
      id: 'templates',
      label: 'Templates',
      Icon: LayoutTemplate,
      onSelect: onOpenTemplatePicker,
    },
    {
      id: 'sections',
      label: 'Sections',
      Icon: ListPlus,
      onSelect: onOpenSectionModal,
    },
    ...(onOpenSectionOrder
      ? [
          {
            id: 'section-order',
            label: 'Reorder professionally',
            Icon: Rows3,
            onSelect: onOpenSectionOrder,
          },
        ]
      : []),
    ...(showBuildWithAi
      ? [
          {
            id: 'ai',
            label: 'Build with AI',
            Icon: Sparkles,
            onSelect: onOpenAiChat,
          },
        ]
      : []),
  ];

  useLayoutEffect(() => {
    if (!open || inlineMenu) {
      setMenuPos(null);
      return;
    }
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      let left = r.right - MENU_MIN_PX;
      left = Math.max(8, Math.min(left, vw - MENU_MIN_PX - 8));
      setMenuPos({ top: r.bottom + 4, left });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, inlineMenu]);

  useEffect(() => {
    if (!open || inlineMenu) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      const el = wrapRef.current;
      if (el?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-cv-mobile-more-menu]'))
        return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onDocPointerDown, true);
  }, [open, inlineMenu]);

  const menuButtons = (
    <>
      {navItems.map(({ id, label, Icon, onSelect }) => (
        <button
          key={id}
          type="button"
          role="menuitem"
          className={MENU_ITEM_CLASS}
          onClick={() => closeAnd(onSelect)}
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-[#00C9B1]" />
          {label}
        </button>
      ))}
      <button
        type="button"
        role="menuitem"
        className={`${MENU_ITEM_CLASS} disabled:opacity-40`}
        disabled={spellChecking}
        onClick={() => closeAnd(onTriggerSpellCheck)}
      >
        {spellChecking ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#00C9B1]" />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-[#00C9B1]" />
        )}
        Check spelling
      </button>
      <button
        type="button"
        role="menuitem"
        className={`${MENU_ITEM_CLASS} disabled:opacity-40`}
        disabled={runScan.isPending}
        onClick={async () => {
          setOpen(false);
          try {
            await runScan.mutateAsync(targetId);
            const impr = await queryClient.fetchQuery({
              queryKey: cvSuggestionsQueryKey(targetId),
              queryFn: () =>
                api.cv.getSuggestions(targetId ?? undefined, false),
            });
            const n = impr.pendingSuggestionsCount ?? impr.improvements.length;
            toast.success(`CV scan complete — ${n} suggestions found`);
          } catch (e) {
            toast.error(getApiErrorMessage(e));
          }
        }}
      >
        {runScan.isPending ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#00C9B1]" />
        ) : (
          <FileSearch className="h-3.5 w-3.5 shrink-0 text-[#00C9B1]" />
        )}
        CV scan
      </button>
    </>
  );

  return (
    <>
      <div
        ref={wrapRef}
        className={cn('relative shrink-0', inlineMenu && 'w-full')}
      >
        <Button
          type="button"
          variant="ghost"
          className={cn(
            'h-8 shrink-0 gap-1 border border-white/10 px-2.5 text-xs text-white/80',
            inlineMenu && 'w-full justify-start',
          )}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
        >
          <MoreHorizontal className="h-3.5 w-3.5 shrink-0 text-[#00C9B1]" />
          More
        </Button>
        {inlineMenu && open ? (
          <div
            data-cv-mobile-more-menu
            role="menu"
            className="mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#111616] py-1 shadow-inner"
          >
            {menuButtons}
          </div>
        ) : null}
      </div>
      {!inlineMenu && open && menuPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-cv-mobile-more-menu
              role="menu"
              className="fixed z-[500] min-w-[11.5rem] rounded-xl border border-white/10 bg-[#0C0F0F] py-1 shadow-[0_12px_40px_rgba(0,0,0,0.55)] ring-1 ring-black/30"
              style={{ top: menuPos.top, left: menuPos.left }}
            >
              {menuButtons}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
