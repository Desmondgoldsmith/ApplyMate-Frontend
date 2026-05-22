import type { Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

import { PageBackground } from '@/components/landing/PageBackground';
import { buildRootMetadata } from '@/lib/seo/metadata';

import { Providers } from './providers';

import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata = buildRootMetadata();

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#060A0A' },
    { media: '(prefers-color-scheme: light)', color: '#060A0A' },
  ],
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`} data-theme="dark">
      <body className="flex min-h-full flex-col font-sans">
        <PageBackground />
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
