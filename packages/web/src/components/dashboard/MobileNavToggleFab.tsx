'use client';

import { LayoutGrid, X } from 'lucide-react';

import { useMobileShell } from '@/components/dashboard/MobileShellContext';
import { cn } from '@/lib/utils';

/** Toggle bottom navigation on mobile (hidden by default). */
export function MobileNavToggleFab() {
  const { navVisible, toggleNav, navBottomOffset } = useMobileShell();

  return (
    <button
      type="button"
      data-tour="mobile-nav-toggle"
      onClick={toggleNav}
      aria-label={navVisible ? 'Hide navigation' : 'Show navigation'}
      aria-expanded={navVisible}
      style={{
        bottom: navVisible ? '72px' : navBottomOffset,
      }}
      className={cn(
        'fixed left-3 z-[88] flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border shadow-[0_10px_28px_rgba(0,0,0,0.42)] transition-[border-color,background-color,bottom] duration-200 lg:hidden',
        navVisible
          ? 'border-[#00C9B1]/55 bg-[#00C9B1]/15 text-[#00C9B1]'
          : 'border-white/15 bg-[#0C0F0F]/95 text-white/75',
      )}
    >
      {navVisible ? (
        <X className="h-5 w-5" />
      ) : (
        <LayoutGrid className="h-5 w-5" />
      )}
    </button>
  );
}
