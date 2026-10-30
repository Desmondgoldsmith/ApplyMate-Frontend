import Link from 'next/link';
import type { ReactNode } from 'react';

import { AuthSkyPanel } from '@/components/auth/AuthSkyPanel';
import { BrandMark } from '@/components/brand/BrandMark';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

/** Split layout for sign-in / sign-up: form column + 3D sky panel on large screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen bg-bg-page lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-4 lg:p-4">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[340px] lg:hidden"
        style={{
          background:
            'radial-gradient(70% 100% at 85% 0%, var(--ck-glow-a), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative flex min-h-screen flex-col px-5 py-5 sm:px-8 lg:min-h-0 lg:px-10 lg:py-6">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-border-focus"
          >
            <BrandMark />
          </Link>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[400px]">
            <h1 className="font-display text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-text-primary sm:text-[40px]">
              {title}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-text-secondary">
              {subtitle}
            </p>
            <div className="mt-8">{children}</div>
            <div className="mt-8 text-sm text-text-secondary">{footer}</div>
          </div>
        </main>
      </div>
      <AuthSkyPanel />
    </div>
  );
}
