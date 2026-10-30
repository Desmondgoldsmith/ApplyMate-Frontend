import type { ReactNode } from 'react';

import { PageBackground } from '@/components/landing/PageBackground';

/**
 * Pins a subtree to the original dark look (teal glow background, dark
 * tokens, white text) whatever theme the user picked. For screens that still
 * use hard-coded dark colours: the landing page by design, and app areas
 * until they are moved onto theme tokens. Remove per area once converted.
 */
export function LegacyDarkScope({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark" className="contents text-white">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <PageBackground />
      </div>
      {children}
    </div>
  );
}
