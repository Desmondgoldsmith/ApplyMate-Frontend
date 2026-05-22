import type { Metadata } from 'next';

import {
  absoluteUrl,
  DEFAULT_OG_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  getSiteUrl,
} from '@/lib/site';

const defaultTitle = `${SITE_NAME} — ${SITE_TAGLINE}`;

export function buildRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const ogImage = absoluteUrl(DEFAULT_OG_IMAGE_PATH);

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultTitle,
      template: `%s · ${SITE_NAME}`,
    },
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: [
      'ApplyMate',
      'job application',
      'CV matcher',
      'resume tailoring',
      'cover letter AI',
      'job search',
      'application tracker',
      'interview prep',
    ],
    authors: [{ name: SITE_NAME }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    openGraph: {
      type: 'website',
      locale: 'en_GB',
      url: siteUrl,
      siteName: SITE_NAME,
      title: defaultTitle,
      description: SITE_DESCRIPTION,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${SITE_NAME} — Apply smarter, get hired faster`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: SITE_DESCRIPTION,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: siteUrl,
    },
    icons: {
      icon: [{ url: '/icon', type: 'image/png', sizes: '32x32' }],
      apple: [{ url: '/icon', type: 'image/png', sizes: '32x32' }],
    },
  };
}

export function buildMarketingPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const canonical = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: canonical,
    },
    twitter: {
      title: `${title} · ${SITE_NAME}`,
      description,
    },
  };
}

/** Logged-in app surfaces should not compete with marketing pages in search. */
export function buildAppNoIndexMetadata(title: string): Metadata {
  return {
    title,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
    },
  };
}
