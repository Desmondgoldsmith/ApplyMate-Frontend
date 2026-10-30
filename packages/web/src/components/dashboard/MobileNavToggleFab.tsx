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
        'fixed left-3 z-[88] flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border shadow-overlay transition-[border-color,background-color,bottom] duration-200 lg:hidden',
        navVisible
          ? 'border-accent-border bg-accent-subtle text-accent-text'
          : 'border-border-default bg-bg-surface text-text-secondary',
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
