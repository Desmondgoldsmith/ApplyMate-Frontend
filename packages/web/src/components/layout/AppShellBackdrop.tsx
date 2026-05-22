import type { CSSProperties } from 'react';

/** Matches landing hero left column: teal wash + deep black ramp (full-bleed app shell). */
const shellBlend: CSSProperties = {
  background: `
    radial-gradient(ellipse 78% 88% at 20% 44%, rgba(0,201,177,0.075) 0%, rgba(6,10,10,0.2) 45%, transparent 62%),
    linear-gradient(105deg, #060A0A 0%, #060A0A 14%, #071010 30%, #050B0B 46%, #030707 62%, #020404 78%, #060A0A 100%)
  `,
};

const shellDepth: CSSProperties = {
  background:
    'radial-gradient(ellipse 55% 70% at 85% 75%, rgba(0,130,130,0.06) 0%, transparent 55%)',
};

type AppShellBackdropProps = {
  className?: string;
};

/**
 * Sits behind dashboard or auth content. Root layout already renders {@link PageBackground};
 * this adds the same hero-style teal ↔ black depth so shells are not flat black.
 */
export function AppShellBackdrop({ className = '' }: AppShellBackdropProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0" style={shellBlend} />
      <div className="absolute inset-0" style={shellDepth} />
    </div>
  );
}
