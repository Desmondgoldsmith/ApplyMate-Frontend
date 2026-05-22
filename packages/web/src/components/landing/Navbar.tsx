'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { trackMarketingCta } from '@/components/analytics/MarketingAnalytics';

import { ChromeIcon } from './ChromeIcon';
import { GlowChromeCta } from './GlowChromeCta';

const links = [
  { href: '#how-it-works', label: 'How it Works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 z-50 w-full border-b transition-[background-color,border-color] duration-300 ease-out"
      style={{
        backgroundColor: scrolled
          ? 'rgba(6, 10, 10, 0.92)'
          : 'rgba(6, 10, 10, 0.8)',
        borderColor: scrolled
          ? 'rgba(0, 174, 175, 0.18)'
          : 'rgba(0, 174, 175, 0.1)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-[8%]">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: '#00C9B1', boxShadow: '0 0 12px #00C9B1' }}
            aria-hidden
          />
          <span className="text-[17px] font-bold tracking-tight text-white">
            ApplyMate
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex lg:gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap text-[13px] font-medium text-[rgba(255,255,255,0.6)] transition-colors duration-200 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            onClick={() => trackMarketingCta('sign_in', 'navbar')}
            className="hidden rounded-full border border-[rgba(255,255,255,0.18)] px-3 py-2 text-[11px] font-semibold tracking-wide text-white transition-colors duration-200 hover:border-[rgba(0,201,177,0.45)] md:inline-flex sm:px-4 sm:text-[12px]"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            onClick={() => trackMarketingCta('sign_up', 'navbar')}
            className="rounded-full border border-[rgba(0,201,177,0.38)] bg-[rgba(0,201,177,0.1)] px-3 py-2 text-[11px] font-semibold tracking-wide text-[#b8f0f0] shadow-[0_0_20px_rgba(0,201,177,0.12)] transition-colors duration-200 hover:border-[rgba(0,201,177,0.55)] hover:bg-[rgba(0,201,177,0.16)] hover:text-white sm:px-4 sm:text-[12px]"
          >
            Sign up
          </Link>
          <GlowChromeCta
            href="#cta"
            size="compact"
            className="hidden lg:inline-block"
            onClick={() => trackMarketingCta('chrome_extension', 'navbar')}
          >
            <ChromeIcon className="shrink-0" />
            Add to Chrome — Free
          </GlowChromeCta>
        </div>
      </div>
    </header>
  );
}
