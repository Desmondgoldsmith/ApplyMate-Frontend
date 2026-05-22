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
    setUntil(readPremiumActiveUntil());
    const onStorage = () => setUntil(readPremiumActiveUntil());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!until) return null;
  const expires = new Date(until).getTime();
  if (!Number.isFinite(expires) || expires < Date.now()) return null;

  return (
    <div className="rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/10 px-4 py-2.5 text-[13px] text-[#8af3e7]">
      Premium active until: <span className="font-semibold text-white">{formatUntil(until)}</span>
    </div>
  );
}
