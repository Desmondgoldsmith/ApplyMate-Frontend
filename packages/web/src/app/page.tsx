import { MarketingAnalytics } from '@/components/analytics/MarketingAnalytics';
import { LandingPage } from '@/components/landing/LandingPage';
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  WebSiteJsonLd,
} from '@/components/seo/JsonLd';
import { buildMarketingPageMetadata } from '@/lib/seo/metadata';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export const metadata = buildMarketingPageMetadata({
  title: `${SITE_NAME} — ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  path: '/',
});

export default function HomePage() {
  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <SoftwareApplicationJsonLd />
      <MarketingAnalytics />
      <LandingPage />
    </>
  );
}
