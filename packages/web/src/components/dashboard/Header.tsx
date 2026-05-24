'use client';

import { Search, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { AiUsageBadge } from '@/components/dashboard/AiUsageBadge';
import { DashboardBreadcrumbs } from '@/components/dashboard/DashboardBreadcrumbs';
import { DashboardUserMenu } from '@/components/dashboard/DashboardUserMenu';
import { NotificationBell } from '@/components/dashboard/NotificationBell';
import { Button } from '@/components/ui/Button';

function SearchCommandPlaceholder({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 px-4 pt-[min(20vh,8rem)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cmdk-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0c1010] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-white/35" aria-hidden />
          <input
            autoFocus
            readOnly
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium text-white/90 outline-none placeholder:text-white/35"
            placeholder="Search coming soon…"
            aria-label="Search"
          />
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-4">
          <p id="cmdk-title" className="text-[13px] font-medium text-white/55">
            Command palette (⌘K) will search jobs, analyses, and CVs.
          </p>
          <p className="mt-2 text-[12px] text-white/35">Press Esc to close.</p>
          <Button
            type="button"
            variant="ghost"
            className="mt-4 w-full text-[#00C9B1]"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false);

  const onKeyGlobal = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', onKeyGlobal);
    return () => window.removeEventListener('keydown', onKeyGlobal);
  }, [onKeyGlobal]);

  return (
    <>
      <SearchCommandPlaceholder
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      <header className="sticky top-0 z-[60] flex h-14 min-h-[56px] shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] bg-[#080b0a]/95 px-3 backdrop-blur-md sm:gap-3 sm:px-5 supports-[backdrop-filter]:bg-[#080b0a]/92">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Suspense
            fallback={
              <h1 className="min-w-0 truncate text-[17px] font-semibold tracking-tight text-white/95 sm:text-[18px]">
                Dashboard
              </h1>
            }
          >
            <DashboardBreadcrumbs className="min-w-0 flex-1" />
          </Suspense>
        </div>

        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
          <AiUsageBadge
            variant="compact"
            className="min-w-0 max-w-[min(52vw,13rem)] sm:max-w-[min(46vw,15rem)]"
          />
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/55 transition-colors hover:border-[#00C9B1]/35 hover:bg-white/[0.04] hover:text-[#00C9B1]"
            aria-label="Open search (⌘K)"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <NotificationBell />
          <DashboardUserMenu />
        </div>
      </header>
    </>
  );
}
