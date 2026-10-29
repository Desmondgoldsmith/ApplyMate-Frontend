'use client';

import { useEffect, useState } from 'react';

import { readPremiumActiveUntil } from '@/components/job-hub/PlacementVerificationModal';

function formatUntil(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function CareerPremiumBanner() {
  const [until, setUntil] = useState<string | null>(null);

  useEffect(() => {
    /** Only a still-active premium window is kept (the clock is read here, not during render). */
    const read = () => {
      const iso = readPremiumActiveUntil();
      const expires = iso ? new Date(iso).getTime() : Number.NaN;
      setUntil(Number.isFinite(expires) && expires >= Date.now() ? iso : null);
    };
    read();
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, []);

  if (!until) return null;

  return (
    <div className="rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/10 px-4 py-2.5 text-[13px] text-[#8af3e7]">
      Premium active until: <span className="font-semibold text-white">{formatUntil(until)}</span>
    </div>
  );
}
