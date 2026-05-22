import { atmosphereForMode } from '@/components/dashboard/assistant-voice/atmosphere';

/** Vertical rhythm between major dashboard sections (Tailwind gap class fragment). */
export function sectionPacingClass(mode: string | null): string {
  return atmosphereForMode(mode).sectionGapClass;
}
