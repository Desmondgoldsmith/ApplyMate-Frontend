import type { Viewport } from 'next';
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from 'next/font/google';

import { buildRootMetadata } from '@/lib/seo/metadata';
import { THEME_INIT_SCRIPT } from '@/lib/theme/themePreference';

import { Providers } from './providers';

import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta-sans',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600', '700', '800'],
});

export const metadata = buildRootMetadata();

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0e110f' },
    { media: '(prefers-color-scheme: light)', color: '#f6f7f1' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${bricolage.variable} h-full antialiased`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
