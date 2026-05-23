'use client';

import { MapPin } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import type { ResolvedGeoLocation } from '@/store/useLocationStore';

function formatDetectedLabel(geo: ResolvedGeoLocation): string {
  const city = geo.city?.trim();
  const country = geo.country?.trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || 'your area';
}

export function LocationConfirmPrompt({
  open,
  detected,
  onUseDetected,
  onChange,
  onDismiss,
}: {
  open: boolean;
  detected: ResolvedGeoLocation;
  onUseDetected: () => void;
  onChange: () => void;
  onDismiss: () => void;
}) {
  const label = formatDetectedLabel(detected);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
      title="Job search location"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-[#00C9B1]/25 bg-[#00C9B1]/5 p-4">
          <MapPin
            className="mt-0.5 h-5 w-5 shrink-0 text-[#00C9B1]"
            aria-hidden
          />
          <div>
            <p className="text-sm font-medium text-white">
              We detected <span className="text-[#7ef4e6]">{label}</span> — use
              this location for your job search?
            </p>
            <p className="mt-1 text-xs text-white/45">
              This helps us show relevant roles when your CV does not list a
              location. You can change it anytime in the job board filters.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onDismiss}>
            Not now
          </Button>
          <Button type="button" variant="ghost" onClick={onChange}>
            Change location
          </Button>
          <Button type="button" onClick={onUseDetected}>
            Use this location
          </Button>
        </div>
      </div>
    </Modal>
  );
}
