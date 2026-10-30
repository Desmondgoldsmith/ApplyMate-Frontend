import { KiteHero } from '@/components/brand/KiteHero';
import { SkyBackdrop } from '@/components/brand/SkyBackdrop';

/** Right-hand "sky" on the sign-in and sign-up pages: the 3D kite and one line of story. */
export function AuthSkyPanel() {
  return (
    <aside className="relative hidden overflow-hidden rounded-[28px] border border-border-subtle bg-bg-sunken lg:flex lg:flex-col">
      <SkyBackdrop />
      <KiteHero className="min-h-0 flex-1" />
      <div className="relative px-10 pb-10">
        <p className="font-display text-[44px] font-bold leading-[1.02] tracking-[-0.03em] text-text-primary">
          Your career, rising.
        </p>
        <p className="mt-3 max-w-[40ch] text-[15px] leading-relaxed text-text-secondary">
          Build a CV that stands out, find roles that fit and track every
          application in one place.
        </p>
      </div>
    </aside>
  );
}
