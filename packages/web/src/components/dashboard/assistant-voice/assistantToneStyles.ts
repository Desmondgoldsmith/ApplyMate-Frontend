import { cn } from '@/lib/utils';

/**
 * Maps Phase 3 `assistantTone` slug to subtle shell accents — never rendered as raw text.
 */
export function assistantToneStripClass(tone: string | null | undefined): string {
  const t = (tone ?? '').toLowerCase();
  if (t.includes('warm_recovery') || t.includes('recovery')) {
    return 'border-l-[#8ECFC8]/35 bg-gradient-to-r from-[#8ECFC8]/[0.06] to-transparent';
  }
  if (t.includes('gentle') || t.includes('nudge')) {
    return 'border-l-white/15 bg-white/[0.02]';
  }
  if (t.includes('calm')) {
    return 'border-l-[#00C9B1]/22 bg-[#00C9B1]/[0.04]';
  }
  if (t.includes('focused') || t.includes('drive')) {
    return 'border-l-[#00C9B1]/30 bg-[#00C9B1]/[0.05]';
  }
  return 'border-l-[#00C9B1]/18 bg-[#00C9B1]/[0.03]';
}

export function assistantToneHeroAccentClass(tone: string | null | undefined): string {
  const t = (tone ?? '').toLowerCase();
  if (t.includes('recovery')) return cn('ring-1 ring-white/[0.06]');
  if (t.includes('calm_progress') || t.includes('calm')) return cn('ring-1 ring-[#00C9B1]/12');
  return '';
}
