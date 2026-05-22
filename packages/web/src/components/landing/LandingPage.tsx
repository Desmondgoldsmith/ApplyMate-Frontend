'use client';

import { Faq } from './Faq';
import { FeaturesBento } from './FeaturesBento';
import { FinalCta } from './FinalCta';
import { Footer } from './Footer';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { MarqueeBar } from './MarqueeBar';
import { Navbar } from './Navbar';
import { Pricing } from './Pricing';
import { Showcase } from './Showcase';
import { Testimonials } from './Testimonials';

export function LandingPage() {
  return (
    <div className="min-h-screen text-white selection:bg-[#00C9B1]/30">
      <Navbar />
      <main>
        <Hero />
        <MarqueeBar />
        <HowItWorks />
        <FeaturesBento />
        <Showcase />
        <Testimonials />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
