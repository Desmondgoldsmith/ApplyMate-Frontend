'use client';

import confetti from 'canvas-confetti';
import { useEffect } from 'react';

export function AcceptedCelebrationOverlay({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    const burst = () => {
      void confetti({
        particleCount: 90,
        spread: 75,
        origin: { y: 0.55 },
        colors: ['#00C9B1', '#ffffff', '#F59E0B', '#00A896'],
      });
    };
    burst();
    const t = window.setTimeout(burst, 280);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      aria-hidden
    >
      <div className="rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-500/20 via-[#0C0F0F] to-[#00C9B1]/15 px-8 py-6 text-center shadow-2xl">
        <p className="text-4xl" aria-hidden>
          🎉
        </p>
        <p className="mt-2 text-lg font-semibold text-white">You accepted an offer!</p>
        <p className="mt-1 text-sm text-white/55">Time to celebrate your win.</p>
      </div>
    </div>
  );
}
